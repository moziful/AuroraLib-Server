const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.MONGODB_URI_USER}:${process.env.MONGODB_URI_PASSWORD}@cluster0.1oucwva.mongodb.net/?appName=Cluster0`;
const { createRemoteJWKSet, jwtVerify } = require('jose');


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let JWKS;
const getJWKS = () => {
    if (!JWKS) {
        JWKS = createRemoteJWKSet(
            new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
        );
    }
    return JWKS;
};

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const { payload } = await jwtVerify(token, getJWKS());
        req.user = payload;
        next();
    } catch (err) {
        console.error('[verifyToken] error:', err.message);
        return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
    }
};

const allowedOrigins = [
    "http://localhost:3000",
    process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        //Here we will get data.
        const db = client.db('AuroraLib');
        const allBooks = db.collection('books');
        const usersCol = db.collection('user');
        app.get('/books', async (req, res) => {
            try {
                const { search, status, sort } = req.query;
                let query = {};
                if (search) {
                    query.$or = [
                        { title: { $regex: search, $options: 'i' } },
                        { writerName: { $regex: search, $options: 'i' } },
                        { genre: { $regex: search, $options: 'i' } }
                    ];
                }
                if (status && status !== 'all') {
                    query.status = status;
                }
                let sortOptions = { createdAt: -1 }; // default newest
                if (sort === 'price_low') {
                    sortOptions = { price: 1 };
                } else if (sort === 'price_high') {
                    sortOptions = { price: -1 };
                } else if (sort === 'newest') {
                    sortOptions = { createdAt: -1 };
                } else if (sort === 'oldest') {
                    sortOptions = { createdAt: 1 };
                }
                const cursor = allBooks.find(query).sort(sortOptions);
                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching books:", error);
                res.status(500).json({ message: "Server error fetching books" });
            }
        });
        app.get('/books/email/:email', async (req, res) => {
            try {
                const cursor = allBooks.find({ writerEmail: req.params.email });
                const result = await cursor.toArray();
                res.send(result);
            } catch (err) {
                console.error("Database error:", err);
                res.status(500).json({ message: "Server error" });
            }
        });
        app.get('/books/:id', async (req, res) => {
            try {
                const book = await allBooks.findOne({ _id: new ObjectId(req.params.id) });
                if (!book) {
                    return res.status(404).json({ message: "Book not found" });
                }
                res.send(book);
            } catch (err) {
                console.error("Database error:", err);
                res.status(500).json({ message: "Server error" });
            }
        });
        app.post("/books", verifyToken, async (req, res) => {
            try {
                if (!req.user) {
                    return res.status(401).json({
                        success: false,
                        message: "Unauthorized",
                    });
                }

                const { role, email } = req.user;

                if (role !== "writer") {
                    return res.status(403).json({
                        success: false,
                        message: "Only writers can add books",
                    });
                }

                const {
                    title,
                    description,
                    price,
                    genre,
                    coverImage,
                    writerName,
                    writerEmail,
                    status,
                    isFeatured,
                } = req.body;

                if (!title || !genre || !writerName || !writerEmail) {
                    return res.status(400).json({
                        success: false,
                        message: "title, genre, writerName, and writerEmail are required.",
                    });
                }

                const book = {
                    title,
                    description: description || "",
                    price: parseFloat(price) || 0,
                    genre,
                    coverImage: coverImage || "",
                    writerName,
                    writerEmail: writerEmail || email,
                    status: status || "Available",
                    isFeatured: Boolean(isFeatured),
                    bookmarks: [],
                    createdAt: new Date().toISOString(),
                };

                const result = await allBooks.insertOne(book);

                return res.status(201).json({
                    success: true,
                    insertedId: result.insertedId,
                });
            } catch (error) {
                console.error("POST /books failed:", error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to add book",
                });
            }
        });

        // UPDATE BOOK DETAILS
        app.put("/books/:id", verifyToken, async (req, res) => {
            try {
                // Allow writers and admins to update books
                if (!req.user || (req.user.role !== "writer" && req.user.role !== "admin")) {
                    return res.status(403).json({ success: false, message: "Only writers or admins can update books" });
                }
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };

                // Verify ownership for writers only
                const existingBook = await allBooks.findOne(filter);
                if (!existingBook) return res.status(404).json({ success: false, message: "Book not found" });
                if (req.user.role === "writer" && existingBook.writerEmail !== req.user.email) {
                    return res.status(403).json({ success: false, message: "You can only edit your own books" });
                }

                const { title, description, price, genre, coverImage, status } = req.body;
                const updateDoc = {
                    $set: {
                        title,
                        description: description || "",
                        price: parseFloat(price) || 0,
                        genre,
                        coverImage,
                        status: status || "Available",
                    },
                };
                const result = await allBooks.updateOne(filter, updateDoc);
                res.json({ success: true, modifiedCount: result.modifiedCount });
            } catch (error) {
                console.error("PUT /books/:id failed:", error);
                res.status(500).json({ success: false, message: "Failed to update book" });
            }
        });

        // UPDATE BOOK STATUS
        app.patch("/books/:id/status", verifyToken, async (req, res) => {
            try {
                // Allow writers and admins to update status
                if (!req.user || (req.user.role !== "writer" && req.user.role !== "admin")) {
                    return res.status(403).json({ success: false, message: "Only writers or admins can update status" });
                }
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };

                const existingBook = await allBooks.findOne(filter);
                if (!existingBook) return res.status(404).json({ success: false, message: "Book not found" });
                // Admins can edit any book; writers only their own
                if (req.user.role === "writer" && existingBook.writerEmail !== req.user.email) {
                    return res.status(403).json({ success: false, message: "You can only edit your own books" });
                }

                const { status } = req.body;
                const updateDoc = { $set: { status } };
                const result = await allBooks.updateOne(filter, updateDoc);
                res.json({ success: true, modifiedCount: result.modifiedCount });
            } catch (error) {
                console.error("PATCH /books/:id/status failed:", error);
                res.status(500).json({ success: false, message: "Failed to update status" });
            }
        });

        // DELETE BOOK
        app.delete("/books/:id", verifyToken, async (req, res) => {
            try {
                // Allow writers and admins to delete books
                if (!req.user || (req.user.role !== "writer" && req.user.role !== "admin")) {
                    return res.status(403).json({ success: false, message: "Only writers or admins can delete books" });
                }
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };

                const existingBook = await allBooks.findOne(filter);
                if (!existingBook) return res.status(404).json({ success: false, message: "Book not found" });
                // Admins can delete any book; writers only their own
                if (req.user.role === "writer" && existingBook.writerEmail !== req.user.email) {
                    return res.status(403).json({ success: false, message: "You can only delete your own books" });
                }

                const result = await allBooks.deleteOne(filter);
                res.json({ success: true, deletedCount: result.deletedCount });
            } catch (error) {
                console.error("DELETE /books/:id failed:", error);
                res.status(500).json({ success: false, message: "Failed to delete book" });
            }
        });

        // UPDATE USER
        app.patch("/users/:id", async (req, res) => {
            try {
                // Not using verifyToken for now because frontend might not send a token when calling this from a server action or client.
                const id = req.params.id;
                const { name, email } = req.body;
                
                const updateDoc = { $set: { name, email } };
                
                // Construct a flexible filter because better-auth can use string id, string _id, or ObjectId depending on setup.
                let objectIdMatch = null;
                if (ObjectId.isValid(id) && (String(new ObjectId(id)) === id)) {
                    objectIdMatch = new ObjectId(id);
                }
                
                const filter = {
                    $or: [
                        { _id: id },
                        { id: id }
                    ]
                };
                if (objectIdMatch) {
                    filter.$or.push({ _id: objectIdMatch });
                }

                const result = await usersCol.updateOne(filter, updateDoc);
                
                if (result.matchedCount === 0) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }
                res.json({ success: true, modifiedCount: result.modifiedCount });
            } catch (error) {
                console.error("PATCH /users/:id failed:", error);
                res.status(500).json({ success: false, message: "Failed to update user" });
            }
        });
        
// ---------------------------------------------------------------------
// PATCH: Self‑assign role (reader → writer) after signup
// ---------------------------------------------------------------------
app.patch("/users/:id/role", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    if (!["writer", "reader"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role value" });
    }

    // Ensure the requester is the same user
    const requesterId = req.user.sub || req.user.id || req.user._id;
    if (requesterId !== userId) {
      return res.status(403).json({ success: false, message: "Can only change own role" });
    }

    // Allow upgrade only if current role is reader (or undefined)
    if (req.user.role && req.user.role !== "reader") {
      return res
        .status(403)
        .json({ success: false, message: "Only readers can self‑assign a role" });
    }

    // Flexible filter – same logic used elsewhere for user updates
    let objectIdMatch = null;
    if (ObjectId.isValid(userId) && String(new ObjectId(userId)) === userId) {
      objectIdMatch = new ObjectId(userId);
    }
    const filter = { $or: [{ _id: userId }, { id: userId }] };
    if (objectIdMatch) filter.$or.push({ _id: objectIdMatch });

    const result = await usersCol.updateOne(filter, { $set: { role } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("PATCH /users/:id/role failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update role" });
  }
});
        const upload = multer({ storage: multer.memoryStorage() });
        app.post('/api/upload-image', upload.single('image'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ success: false, message: 'No image file provided.' });
                }

                if (!process.env.IMAGE_BB_API_KEY) {
                    return res.status(500).json({ success: false, message: 'ImgBB API key is not configured on the server.' });
                }

                const base64Image = req.file.buffer.toString('base64');
                const form = new FormData();
                form.append('image', base64Image);

                const response = await axios.post(
                    `https://api.imgbb.com/1/upload?key=${process.env.IMAGE_BB_API_KEY}`,
                    form,
                    { headers: form.getHeaders() }
                );
                const data = response.data;

                if (!data.success) {
                    return res.status(502).json({
                        success: false,
                        message: data?.error?.message || 'ImgBB upload failed.',
                    });
                }

                res.json({
                    success: true,
                    url: data.data.url,
                    display_url: data.data.display_url,
                    delete_url: data.data.delete_url,
                    thumb_url: data.data.thumb?.url || null,
                });
            } catch (error) {
                const errMsg = error?.response?.data?.error?.message || error.message || 'Image upload failed.';
                console.error('ImageBB upload error:', errMsg, error?.response?.data || '');
                res.status(500).json({
                    success: false,
                    message: errMsg,
                });
            }
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hi, from Auroralib Server!');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
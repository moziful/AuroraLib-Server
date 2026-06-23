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
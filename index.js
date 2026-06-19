const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.MONGODB_URI_USER}:${process.env.MONGODB_URI_PASSWORD}@cluster0.1oucwva.mongodb.net/?appName=Cluster0`;
const jwt = require('jsonwebtoken');

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Forbidden: Invalid token" });

        // This is the crucial step: 
        // It injects the user info into the request object!
        req.user = decoded;
        next();
    });
};

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
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
            const cursor = allBooks.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/books/:email', async (req, res) => {
            const cursor = allBooks.find({ writerEmail: req.params.email });
            const result = await cursor.toArray();
            res.send(result);
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
                const form = new FormData();
                form.append('image', req.file.buffer.toString('base64'));

                const response = await axios.post(
                    `https://api.imgbb.com/1/upload?key=${process.env.IMAGE_BB_API_KEY}`,
                    form,
                    { headers: form.getHeaders() }
                );
                const data = response.data;
                res.json({
                    success: true,
                    url: data.data.url,
                    display_url: data.data.display_url,
                    delete_url: data.data.delete_url,
                    thumb_url: data.data.thumb?.url || null,
                });
            } catch (error) {
                console.error('ImageBB upload error:', error?.response?.data || error.message);
                res.status(500).json({
                    success: false,
                    message: error?.response?.data?.error?.message || 'Image upload failed.',
                });
            }
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
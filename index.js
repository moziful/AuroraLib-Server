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

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.use(cors());
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

        app.post('/books', async (req, res) => {
            const {
                title, description, price,
                genre, coverImage,
                writerName, writerEmail,
                status, isFeatured,
            } = req.body;

            if (!title || !genre || !writerName || !writerEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'title, genre, writerName, and writerEmail are required.',
                });
            }
            const book = {
                title,
                description: description || '',
                price: parseFloat(price) || 0,
                genre,
                coverImage: coverImage || '',
                writerName,
                writerEmail,
                status: status || 'Available',
                isFeatured: Boolean(isFeatured),
                bookmarks: [],
                createdAt: new Date().toISOString(),
            };
            const result = await allBooks.insertOne(book);
            res.status(201).json({ success: true, insertedId: result.insertedId });
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
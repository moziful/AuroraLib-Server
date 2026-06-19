const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
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
        await client.connect();

        //Here we will get data.
        const db = client.db('AuroraLib');
        const allBooks = db.collection('books');
        app.get('/books', async (req, res) => {
            const cursor = allBooks.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
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
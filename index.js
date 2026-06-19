const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hi, from Auroralib Server!');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
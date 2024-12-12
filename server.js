const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Create the uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define the Entry schema and model
const entrySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    place: { type: String, required: true },
    message: { type: String, required: true }
}, { timestamps: true });

const Entry = mongoose.model('Entry', entrySchema);

// Define the Image schema and model
const imageSchema = new mongoose.Schema({
    image: String
});
const Image = mongoose.model('Image', imageSchema);

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Multer setup for file uploading
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// Add Entry
app.post('/api/add-entry', async (req, res) => {
    const { name, phone, email, place, message } = req.body;

    try {
        const entry = new Entry({ name, phone, email, place, message });
        await entry.save();

        // Send confirmation email to user
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Data Entry Confirmation',
            text: `Dear ${name},\n\nThank you for your submission. Here are the details we received:\n\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nPlace: ${place}\nMessage: ${message}\n\nWe appreciate your response.\n\nBest regards,\nSuhana Destinations & Travels`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ success: false, message: 'Failed to send email' });
            }
            console.log('Email sent:', info.response);
            res.status(200).json({ success: true, message: 'Entry added and email sent successfully' });
        });
    } catch (error) {
        console.error('Error saving entry:', error);
        res.status(500).json({ success: false, message: 'Failed to save entry' });
    }
});

// Get Entries
app.get('/api/get-entries', async (req, res) => {
    try {
        const entries = await Entry.find();
        res.status(200).json({ success: true, data: entries });
    } catch (error) {
        console.error('Error fetching entries:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch entries' });
    }
});

// Update Entry
app.put('/api/update-entry/:id', async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
        const updatedEntry = await Entry.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedEntry) return res.status(404).json({ success: false, message: 'Entry not found' });
        res.status(200).json({ success: true, data: updatedEntry });
    } catch (error) {
        console.error('Error updating entry:', error);
        res.status(500).json({ success: false, message: 'Failed to update entry' });
    }
});

// Delete Entry
app.delete('/api/delete-entry/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Entry.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting entry:', error);
        res.status(500).json({ success: false, message: 'Failed to delete entry' });
    }
});

// Upload Image
app.post('/api/upload', upload.single('file'), (req, res) => {
    const newImage = new Image({
        image: req.file.filename
    });

    newImage.save()
        .then(result => res.json(result))
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Failed to save image' });
        });
});

// Fetch Images
app.get('/api/images', async (req, res) => {
    try {
        const images = await Image.find();
        const imagesWithUrls = images.map(image => {
            // Construct the correct URL for image access
            const imageUrl = `${process.env.BASE_URL || `https://${req.headers.host}/uploads`}/${image.image}`;
            return {
                id: image._id,
                url: imageUrl
            };
        });
        res.json(imagesWithUrls);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

// Delete Image
app.delete('/api/images/:id', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        const filePath = path.join(__dirname, 'uploads', image.image);
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to delete image file' });
            }
        });

        await Image.findByIdAndDelete(req.params.id);
        res.json({ message: 'Image deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));




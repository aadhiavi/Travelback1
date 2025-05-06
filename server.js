const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const ImageRoutes = require('./routes/imageRoutes');

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*',
    credentials: true,
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
const entrySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    place: { type: String, required: true },
    message: { type: String, required: true }
}, { timestamps: true });

const Entry = mongoose.model('Entry', entrySchema);

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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

app.use('/api/auth', ImageRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));




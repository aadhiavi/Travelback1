const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use((req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'same-site');
  next();
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Entry Schema for storing form data
const entrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  place: { type: String, required: true },
  message: { type: String, required: true }
}, { timestamps: true });

const Entry = mongoose.model('Entry', entrySchema);

// Define Image Schema for storing image file information
const imageSchema = new mongoose.Schema({
  image: String
});
const Image = mongoose.model('Image', imageSchema);

// Setup multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// Add Entry (POST)
app.post('/api/add-entry', async (req, res) => {
  const { name, phone, email, place, message } = req.body;

  try {
    const entry = new Entry({ name, phone, email, place, message });
    await entry.save();
    res.status(200).json({ success: true, message: 'Entry added successfully' });
  } catch (error) {
    console.error('Error saving entry:', error);
    res.status(500).json({ success: false, message: 'Failed to save entry' });
  }
});

// Get Entries (GET)
app.get('/api/get-entries', async (req, res) => {
  try {
    const entries = await Entry.find();
    res.status(200).json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch entries' });
  }
});

// Update Entry (PUT)
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

// Delete Entry (DELETE)
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

// Upload image (POST)
app.post('/api/upload', upload.single('file'), (req, res) => {
  const newImage = new Image({
    image: req.file.filename
  });

  newImage.save()
    .then(result => res.json({ success: true, image: result }))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Failed to save image' });
    });
});

// Fetch all images (GET)
app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find();
    const imagesWithUrls = images.map(image => {
      const imageUrl = `${process.env.BASE_URL || `http://${req.headers.host}`}/uploads/${image.image}`;
      return { id: image._id, url: imageUrl };
    });
    res.json(imagesWithUrls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Remove an image (DELETE)
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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));




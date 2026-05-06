import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Setup temporary storage for uploads
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.post('/api/convert-eps', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(tempDir, `${req.file.filename}.png`);

  // Use ImageMagick to convert EPS to PNG
  const command = `magick "${inputPath}" -colorspace sRGB -density 300 -resize 800x800> "${outputPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Conversion error: ${error.message}`);
      // Clean up input file
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(500).json({ error: 'EPS preview not available' });
    }

    try {
      // Read the generated PNG and convert to base64
      const pngBuffer = fs.readFileSync(outputPath);
      const base64Image = pngBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;

      res.json({ preview: dataUrl });
    } catch (readError) {
      console.error(`Read error: ${readError.message}`);
      res.status(500).json({ error: 'Failed to read converted image' });
    } finally {
      // Cleanup files
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});

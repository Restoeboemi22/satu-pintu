const { Jimp, loadFont, measureText, measureTextHeight } = require('jimp');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const logoPath = path.join(projectRoot, 'logo.png');
const resDir = path.join(projectRoot, 'app', 'src', 'main', 'res');

const sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
};

async function processIcon() {
    if (!fs.existsSync(logoPath)) {
        console.error(`Error: File logo.png tidak ditemukan di ${logoPath}`);
        console.log("Silakan simpan gambar logo Anda sebagai 'logo.png' di folder root proyek.");
        process.exit(1);
    }

    try {
        console.log("Memproses ikon...");
        const image = await Jimp.read(logoPath);
        
        // Resize base image to 512x512 for processing
        image.resize({ w: 512, h: 512 });

        // Load fonts manually from node_modules
        const fontWhitePath = path.join(__dirname, 'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans', 'open-sans-64-white', 'open-sans-64-white.fnt');
        const fontBlackPath = path.join(__dirname, 'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans', 'open-sans-64-black', 'open-sans-64-black.fnt');
        
        const fontWhite = await loadFont(fontWhitePath);
        const fontBlack = await loadFont(fontBlackPath);

        const text = "EduLock";
        const textWidth = measureText(fontWhite, text);
        const textHeight = measureTextHeight(fontWhite, text, 512); // max width 512

        const x = (512 - textWidth) / 2;
        const y = (512 - textHeight) / 2;

        // Draw shadow (black)
        image.print({ font: fontBlack, x: x + 4, y: y + 4, text: text });
        // Draw text (white)
        image.print({ font: fontWhite, x: x, y: y, text: text });

        // Save to mipmap directories
        for (const [folder, size] of Object.entries(sizes)) {
            const targetDir = path.join(resDir, folder);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Remove old webp files to avoid duplicate resource errors
            const webpPath = path.join(targetDir, 'ic_launcher.webp');
            if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
            
            const roundWebpPath = path.join(targetDir, 'ic_launcher_round.webp');
            if (fs.existsSync(roundWebpPath)) fs.unlinkSync(roundWebpPath);

            const targetPath = path.join(targetDir, 'ic_launcher.png');
            const icon = image.clone().resize({ w: size, h: size });
            
            await icon.write(targetPath);
            console.log(`Disimpan: ${targetPath} (${size}x${size})`);
        }
        
        console.log("Selesai! Ikon aplikasi telah diperbarui.");

    } catch (err) {
        console.error("Terjadi kesalahan:", err);
    }
}

processIcon();

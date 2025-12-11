import multer from "multer";
import path from 'path'
import fs from 'fs'

const uploadDir = 'uploads'
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir)
}

const storage = multer.diskStorage({
    destination: (req, file, cd) => {
        cd(null, uploadDir)
    },
    filename: (req, file, cd) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cd(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const fileFilter = (req: any, file: Express.Multer.File, cd: multer.FileFilterCallback ) => {
    if(file.mimetype.startsWith('image/')) {
        cd(null, true)
    } else {
        cd(null,false)
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {fileSize: 5 *  1024 * 1024}
})
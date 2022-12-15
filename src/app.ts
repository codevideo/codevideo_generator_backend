import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import child_process from "child_process";
import multer from "multer";
import fs from "fs";
import AWS from "aws-sdk";
import serverless from "serverless-http";

// load .env file
dotenv.config({ override: true });

// process cors origines env file
if (!process.env.ALLOWED_CORS_ORIGINS) {
  throw new Error("ALLOWED_CORS_ORIGINS env variable is not set, this is required.");
}

// save it to a variable
const allowedOrigins = process.env.ALLOWED_CORS_ORIGINS.split(',');

if (allowedOrigins.length === 0) {
  throw new Error("ALLOWED_CORS_ORIGINS env variable is empty, a value is required. Provide comma separated origins (including the http / https!)");
}

// use memory storage so no files are saved to disk
const storage = multer.memoryStorage();
const upload = multer({ storage });

// setup app - add urlencoded, json, cors and upload middleware
const app: Express = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
  })
);

// define a single POST route
app.post(
  "/",
  upload.single("binary_data"),
  async (req: Request, res: Response) => {
    console.log("In POST handler...")
    console.log("req.file", req.file)
    console.log("req.body", req.body)

    // validation
    if (!req.file || !process.env.AWS_BUCKET_NAME) {
      console.log("Missing params")
      res.status(400).send("Missing params");
      return;
    }

    const binaryFilename = `${new Date().getTime()}-${req.body.filename}.mp4`;
    const videoFilename = `${new Date().getTime()}-${req.body.filename}.mp4`;

    fs.writeFileSync("./tmp/" + binaryFilename, req.file.buffer);

    console.log("Wrote file")

    // same way as in frontend wasm
    const proc = child_process.spawn("ffmpeg", [
      "-i",
      "./tmp/" + binaryFilename,
      "-c:v",
      "libx264",
      "-s",
      req.body.size,
      "./tmp/" + videoFilename,
    ]);

    proc.stdout.pipe(process.stdout);

    console.log({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    // upload to S3
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: "tmp/" + videoFilename,
      Body: fs.createReadStream("./tmp/" + videoFilename),
      ACL: "public-read",
    };

    s3.upload(params, (err: Error, data: AWS.S3.ManagedUpload.SendData) => {
      if (err) {
        throw err;
      }
      if (data) {
        console.log(`File uploaded successfully. ${data.Location}`);
        // remove file in tmp folder
        fs.unlinkSync("./tmp/" + binaryFilename);

        // return S3 file location to client
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ videoUrl: data.Location }));
      }
    });
  }
);

// start the Express server
const port = process.env.PORT;
app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});

// adds compatibility for AWS lambda without affect local development! Nice!
module.exports.handler = serverless(app);

export default app;
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const app = express();

dotenv.config();
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

// firebase admin token
var admin = require("firebase-admin");

var serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const logger = (req, res, next) => {
  console.log("inside the logger middleware");
  next();
};

//verifyToken
const verifyToken = (req, res, next) => {
  const token = req?.cookies.token;
  console.log("cooke in the middleware", token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  // verify token
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

//verifyToken firebase token
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send({ message: "unauthorized access" });
    }

    const token = authHeader.split(" ")[1];

    const userInfo = await admin.auth().verifyIdToken(token);

    req.tokenEmail = userInfo.email;

    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

//conact databse
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rxqtlel.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // jobs collections
    const jobCollection = client.db("career_code").collection("jobs");
    const applicaitonsCollection = client
      .db("career_code")
      .collection("applicaitons");

    // jwt web tooken

    app.post("/jwt", async (req, res) => {
      const userData = req.body;

      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1d",
      });
      // console.log(token);
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
      });
      res.send({ success: "true" });
    });

    // jobs get methords

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/jobs/applicaitons", async (req, res) => {
      const email = req.query.email;
      const query = { hr_email: email };
      const jobs = await jobCollection.find(query).toArray();

      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() };
        const application_count = await applicaitonsCollection.countDocuments(
          applicationQuery
        );
        job.application_count = application_count;
      }
      res.send(jobs);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;

      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    // applicaitons api

    app.get(
      "/applications",
      logger,
      verifyToken,
      verifyFirebaseToken,
      async (req, res) => {
        const email = req.query.email;
        // console.log("inside the cookies", req.cookies);

        if (req.tokenEmail != email) {
          return res.status(404).send({ message: "forbidden access" });
        }

        if (email !== req.decoded.email) {
          return res.status(404).send({ message: "forbidden access" });
        }

        const query = {
          applicat: email,
        };
        const result = await applicaitonsCollection.find(query).toArray();

        // bad way

        for (const application of result) {
          const jobId = application.jobId;
          const jobQuery = { _id: new ObjectId(jobId) };
          const job = await jobCollection.findOne(jobQuery);
          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo;
          application.jobType = job.jobType;
        }

        res.send(result);
      }
    );

    app.get("/applicaitons/job/:job_id", async (req, res) => {
      const job_id = req.params.job_id;
      const query = { jobId: job_id };
      const result = await applicaitonsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const applicaiton = req.body;

      const result = await applicaitonsCollection.insertOne(applicaiton);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await applicaitonsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/applications/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const result = await applicaitonsCollection.deleteOne(query);

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Application deleted" });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Application not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello world");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`serve is running port : http://localhost:${port}/`);
});

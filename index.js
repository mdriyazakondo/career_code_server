const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const app = express();

dotenv.config();
app.use(express.json());
app.use(cors());

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

    // jobs get methords

    app.get("/jobs", async (req, res) => {
      const cursor = jobCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    // applicaitons api

    app.get("/applications", async (req, res) => {
      const email = req.query.email;
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
    });

    app.post("/applications", async (req, res) => {
      const applicaiton = req.body;
      console.log(applicaiton);
      const result = await applicaitonsCollection.insertOne(applicaiton);
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
//DOAVVDemAg6lGiDR

//career_code_project

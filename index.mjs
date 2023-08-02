import bodyParser from "body-parser";
import express, { query } from "express";
import mysql from "mysql";
import util from "util";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import * as dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import path from "path";

const app = express();
const PORT = 5001;
// app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:3000", "*"],
    credentials: true,
  })
);

const connection = mysql.createConnection({
  host: "localhost",
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});
const queryPromise = util.promisify(connection.query).bind(connection);
const SECRET = process.env.SECRET || "topsecret";
//
app.post("/api/v1/signup", async (req, res) => {
  try {
    let body = req.body;
    if (!body.email || !body.password || !body.username)
      throw new Error("All Fields Are Required");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailCheck = emailRegex.test(body.email);
    if (emailCheck == false) {
      res.status(400).send({ message: "invalid email Address" });
      // console.log("jo", jo);
      return;
    }
    connection.query(
      "SELECT * FROM users WHERE email = ?",
      [body.email],
      async (err, rows, fields) => {
        console.log(rows);
        if (!err) {
          if (rows.length > 0) {
            // throw new Error("Email Alreasy exist");
            res.status(400).send({ message: "Email already exists" });
            // console.log(rows.email);
            return;
          }
        }
        let saltRound = 10;
        const salt = await bcrypt.genSalt(saltRound);
        let hashedPass = await bcrypt.hash(body.password, salt);
        console.log(hashedPass);
        connection.query(
          "INSERT INTO users SET ?",
          // "INSERT INTO users SET ?"
          {
            email: body.email,
            password: hashedPass,
            username: body.username,
          },
          (err, result) => {
            if (!err) {
              res.status(200).send({ message: "User SignUp Successfully" });
            }
          }
        );
      }
    );
  } catch (error) {
    res.status(400).send({ message: `${error.message}` });
  }
});

app.post("/api/v1/login", async (req, res) => {
  try {
    let body = req.body;
    console.log(body.password);
    if (!body.email || !body.password)
      throw new Error("All Fields Are Required");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailCheck = emailRegex.test(body.email);
    if (emailCheck == false) {
      res.status(400).send({ message: "invalid email Address" });
      // console.log("jo", jo);
      return;
    }
    let email = connection.query(
      "SELECT * FROM users WHERE email = ?",
      [body.email],
      async (err, rows, fields) => {
        console.log("rows", rows);
        if (rows.length === 0) {
          res.status(400).send({ message: "Email not Found" });
          return;
        }

        console.log("pass", rows[0].password);
        let isMatch = await bcrypt.compare(body.password, rows[0].password);
        if (!isMatch) {
          res.status(400).send({ message: "Wrong Password" });
          return;
        } else {
          let token = jwt.sign(
            {
              id: rows[0].id,
              email: rows[0].email,
              iat: Math.floor(Date.now() / 1000) - 30,
            },
            SECRET
          );
          res.cookie("token", token, { httpOnly: true });
          res.status(200).send({
            message: "user login",
            data: {
              username: rows[0].username,
              email: rows[0].email,
              password: rows[0].password,
              token,
            },
          });
          console.log("rows", rows);
        }
      }
    );
  } catch (error) {
    res.status(400).send({ message: `${error.message}` });
  }
});

app.post("/api/v1/logout", (req, res) => {
  res.cookie("token", "", {
    maxAge: 1,
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });

  res.send({ message: "Logout successful" });
});

app.use("/api/v1", (req, res, next) => {
  console.log("req.cookies:", req.cookies);
  if (!req?.cookies?.token) {
    res.status(401).send({
      message: "include http-only credentials with every request",
    });
    return;
  }
  next();
  // jwt.verify(req.cookies.Token, SECRET, function (err, decodedData) {
  //   if (!err) {
  //     console.log("decodedData: ", decodedData);
  //     const nowDate = new Date().getTime() / 1000;
  //     if (decodedData.exp < nowDate) {
  //       res.status(401);
  //       res.cookie("Token", "", {
  //         maxAge: 1,
  //         httpOnly: true,
  //         sameSite: "none",
  //         secure: true,
  //       });
  //       res.send({ message: "token expired" });
  //     } else {
  //       console.log("token approved");

  //       req.body.token = decodedData;
  //       next();
  //     }
  //   } else {
  //     res.status(401).send("invalid token");
  //   }
  // });
});

app.post("/api/v1/addventory", async (req, res) => {
  try {
    let body = req.body;
    if (
      !body.itemName ||
      !body.costPrice ||
      !body.sellingPrice ||
      !body.quantity ||
      !body.model
    ) {
      res.status(400).send({ message: "All parameters Are required" });
      console.log("Error: All parameters are required");
      return;
    }
    let set = connection.query(
      "INSERT INTO addventory SET ?",
      {
        itemName: body.itemName,
        costPrice: body.costPrice,
        sellingPrice: body.sellingPrice,
        quantity: body.quantity,
        model: body.model,
        // id: body.id,
      },
      (err, result) => {
        if (!err) {
          res.status(200).send({ message: "data inserted Succesfully" });
          console.log("result", result);
          return;
        }
        if (err) {
          res.status(400).send({ message: "data not inserted Succesfully" });
          console.log("err", err);
          return;
        }
      }
    );
  } catch (error) {
    res.status(400).send({ message: "server error" });
  }
});

app.get("/api/v1/getventory", async (req, res) => {
  try {
    let response = connection.query(
      "SELECT * FROM addventory",
      (err, rows, fields) => {
        if (!err) {
          res.status(200).send({ data: rows });
          return;
        }
        if (err) {
          res.status(400).send({ message: "error" });
          return;
        }
      }
    );
  } catch (error) {
    res.status(400).send({ message: "Server Error" });
  }
});

app.delete("/api/v1/delventory/:id", async (req, res) => {
  try {
    let body = req.params;
    if (!body?.id) {
      res.status(400).send({ message: `Invalid Delete Request` });
      return;
    }

    // throw new Error("Invalid Delete Request");
    let deletes = connection.query(
      "DELETE FROM addventory WHERE id = ?",
      [body?.id],
      async (err, result) => {
        if (err) {
          res.status(400).send({ message: `Request failed` });
          return;
        }
        res.status(200).send({ message: "Deleted Successfully" });
        console.log(result);
      }
    );
  } catch (error) {
    res.status(400).send({ message: `${error}` });
    console.log("error");
  }
});

app.put("/api/v1/updateventory", async (req, res) => {
  try {
    let { itemName, costPrice, sellingPrice, quantity, model, id } = req.body;
    if (![itemName, costPrice, sellingPrice, quantity, model].every(Boolean)) {
      res.status(400).send({ message: "all parameters are required" });
      return;
    }
    let update = connection.query(
      "UPDATE addventory SET ? WHERE id = ?",
      [{ itemName, costPrice, sellingPrice, quantity, model }, id],
      (err, result) => {
        if (err) {
          res.status(400).send({ message: "error while updating data" });
          return;
        }
        if (result) {
          if (result.affectedRows < 1) {
            res.status(400).send({ message: "data not found" });
            return;
          } else {
            res.status(200).send({ message: "data updated successfully" });
            return;
          }
        }
      }
    );
  } catch (error) {
    res.status(400).send({ message: "server error" });
    console.log("err", error);
  }
});

app.post("/api/v1/addBilling", async (req, res) => {
  try {
    const { data, totalPrice, profit } = req.body;
    const { itemName, price, quantity } = data[0];
    // console.log(data[0].itemName);
    if (![itemName, price, quantity, totalPrice, profit].every(Boolean)) {
      res.status(400).send({ message: "parameters are missing" });
      return;
    }
    let AddBilling = connection.query(
      "INSERT INTO billing SET ?",
      { data: JSON.stringify(data), totalPrice, profit },
      (err, result) => {
        console.log(result);
        if (!err) {
          res.status(200).send({
            message: "Bill Created Succesfully",
            id: result.insertId,
          });
          // console.log("result", result);
          return;
        }
        if (err) {
          res.status(400).send({ message: "data not inserted Succesfully" });
          console.log("err", err);
          return;
        }
      }
    );
  } catch (error) {
    res.status(400).send({ message: "server Error" });
  }
});

app.get("/api/v1/getbill/:id", async (req, res) => {
  try {
    const { id } = req.params.id;
    if (!req.params.id) {
      res.status(400).send({ message: "required parameters are missing" });
      return;
    }
    let response = connection.query(
      "SELECT * FROM billing WHERE id = ?",
      [req.params.id],
      async (err, rows, fields) => {
        if (rows.length === 0) {
          res.status(400).send({ message: "no data found with this id" });
          return;
        }
        console.log(JSON.parse(rows[0].data));
        res.status(200).send({
          data: JSON.parse(rows[0].data),
          id: rows[0].id,
          createdTime: rows[0].createdTime,
          message: "Data Found Successfully",
          totalPrice:
            rows[0].totalPrice == ""
              ? (rows[0].totalPrice = 0)
              : rows[0].totalPrice,
        });
      }
    );
  } catch (error) {
    res.status(400).send({ message: "server Error" });
  }
});

app.get("/api/v1/getAllBills", async (req, res) => {
  try {
    let response = connection.query(
      "SELECT * FROM billing",
      (err, rows, fields) => {
        if (!err) {
          res.status(200).send({ data: rows });
          return;
        }
        if (err) {
          res.status(400).send({ message: "error" });
          return;
        }
      }
    );
  } catch (error) {
    res.status(400).send({ message: "Server Error" });
  }
});

app.put("/api/v1/resolve", async (req, res) => {
  try {
    const { data, totalPrice, profit } = req.body;
    const { itemName, price, quantity } = data[0];
    // // console.log(data[0].itemName);
    if (![itemName, price, quantity, totalPrice, profit].every(Boolean)) {
      res.status(400).send({ message: "parameters are missing" });
      return;
    }

    const rows = await queryPromise("SELECT * FROM addventory");
    const newData = data.filter((item) =>
      rows.some((row) => row.id === item.id)
    );
    console.log("newData", newData);
    // console.log("rows", rows);
    // return;
    for (const eachItem of newData) {
      const eachRow = rows.find((row) => row.id === eachItem.id);

      if (!eachRow) {
        res
          .status(400)
          .send({ message: `No matching row found for id ${eachItem.id}` });

        return;
      }

      const quantityDiff =
        parseInt(eachRow.quantity) - parseInt(eachItem.quantity);
      if (quantityDiff < 0) {
        res
          .status(400)
          .send({ message: `Quantity error for id ${eachItem.id}` });
        return;
      }

      const result = connection.query("UPDATE addventory SET ? WHERE id = ?", [
        { quantity: quantityDiff.toString() },
        eachItem.id,
      ]);

      if (result.affectedRows < 1) {
        res
          .status(400)
          .send({ message: `Data not found for id ${eachItem.id}` });
        return;
      }
    }

    res.status(200).send({ message: "Data updated successfully" });
    return;
  } catch (error) {
    res.status(400).send({ message: "Server Error" });
  }
});
// ======= //

const __dirname = path.resolve();
app.use("/", express.static(path.join(__dirname, "./inventory/build")));
app.use("*", express.static(path.join(__dirname, "./inventory/build")));

//------//
connection.connect((err) => {
  if (err) console.log(`Database connection failed ${err}`);
  console.log("connection successfull..");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

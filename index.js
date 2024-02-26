const express = require('express');//express makes API's ~ connect frontend to database
const Redis = require('redis');//import the Redis Library
const bodyParser = require('body-parser');
const cors = require('cors');
const { addOrder, getOrder } = require("./services/orderservice.js")); //import the addOrder function from the orderservice.js file
const { addOrderItem, getOrderItem } = require("./services.orderItems"); // import the addOrderItem function from 
const fs = require("fs"); //import the file system library
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json", "utf8"));//read the orderItemSchema.json file
const Ajv = require("ajv"); //import the ajv library
const ajv = new Ajv(); // create an ajv object to validate JSON

const options = {
    origin:'http://localhost:3000'//allow our frontend to call this backend
}

const app = express();//create on express application ~ it's like a constructor 
const redisClient = Redis.createClient({
    url:`redis://localhost:6379`
});

app.use(bodyParser.json());
app.use(cors(options));//allow frontend to call backend

const port = 3001;//this is the port number
app.listen(port, ()=>{
    redisClient.connect();//this connects to the redis database! ! ! ! ! !
    console.log(`API is listening on port: ${port}`);
});//listen for web requests from the front end and don't stop

//Order 
app.post("/orders", async (req, res) => {
    let order = req.body;
    //order details, include product quantity and shipping address
    let responseStatus = order.productQuantity
    ? 200
    : 400 && order.ShippingAddress
    ? 200
    : 400;

    if (responseStatus === 200) {
        try {
            //addOrder funciton to handle order creation in the database
            await addOrder({ redisClient, order });
        } catch (error) {
            console.error(error);
            res.status(500).send("Internal Server Error");
            return;
        }
    } else {
        res.status(responseStatus);
        res.send(
            `Missing one of the following fields: ${exactMatchOrderFields()} ${partiallyMatchOrderFields()}`
        );
    }
    res.status(responseStatus).send();
});

app.get("/orders/:orderID", async (req, res) => {
    //get the order from database
    const orderID = req.params.orderID;
    let order = await getOrder({ redisClient, orderId });
    if (order === null) {
        res.status(404).send("Order not found");
    } else {
        res.json(order);
    }
});

//Order Items

app.post("/orderItems", async (req, res) => {
    try {
        console.log("Schema:", Schema);
        const validate = ajv.compile(Schema);
        const valid = validate(req.body);
        if (!valid) {
            return res.status(400).json({ error: "Invalid request body" });
        }
        console.log("Request Body:", req.body);

        //Calling addOrderItem function and storing the result
        const orderItemId = await addOrderItem({
            redisClient, 
            orderItem: req.body,
        });

        //Responding with the result
        res
        .status(201)
        .json({ orderItemId, message: "Order item added successfully" });
    } catch (error) {
        console.error("Error adding order item", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/orderItems/:orderItemId", async (re, res) => {
    try {
        const orderItemId = req.params.orderItemId;
        const orderItem = await getOrderItem({ redisClient, orderItemId });
        res.json(orderItem);
    } catch (error) {
        console.error("Error getting order item:", error);
        res.status(50).json({ error: "Internal server error" });
    }
});

// 1. URL
// 2. A function to return boxes
// 3. req = the request from the browser
// 4. res = the response from the browser

//A function to create a new product
app.post('/products', async (req, res)=>{// async means we will await promises

    const newProduct = req.body; //getting the body from postman, you can edit the products there!!!

    const productKey = `product:${newProduct.productID}-${Date.now()}`;//creating the unique product ID (to name it in redis), with the productID and the current date information

    try {
        // Set the value of the 'product' key in Redis with the JSON object
        await redisClient.json.set(productKey, '.', newProduct);
        console.log('Product added successfully to Redis');
      } catch (error) {
        console.error('Error adding product to Redis:', error);
      }
    res.json(newProduct);//respond with a new product
});

app.get('/products/:productID', async (req, res)=>{
    
    let products = await redisClient.json.get(`product:${req.params.productID}`);
    res.json(products);
});

app.get('/boxes', async (req, res)=>{
    let boxes = await redisClient.json.get('boxes',{path: '$'});//get the boxes
    //send the boxes to the browser
    res.json(boxes[0]);//the boxes is an array of arrays, convert first element to a JSON string
});//return boxes to the user

app.post('/boxes', async (req, res)=>{// async means we will await promises
    const newBox = req.body;
    newBox.id = parseInt(await redisClient.json.arrLen('boxes','$'))+1;//the user shouldn't be allowed to choose the ID
    await redisClient.json.arrAppend('boxes', '$',newBox); //saves the JSON in redis
    res.json(newBox);//respond with a new box
});

console.log("If you see this message, a nuclear warhead has been launched and will arrive at your location shortly. Thanks!");

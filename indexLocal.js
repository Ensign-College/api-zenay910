const express = require('express');//express makes API's ~ connect frontend to database
const Redis = require('redis');//import the Redis Library
const bodyParser = require('body-parser');
const cors = require('cors');
const { addProduct, getProduct } = require("./services/Products/ProductService.js");
const { addOrder, getOrder } = require("./services/Orders/OrderService.js"); //import the addOrder function from the orderService.js file
const { addOrderItem, getOrderItem } = require("./services/Orders/OrderItems.js"); // import the addOrderItem function from 
const fs = require("fs"); //import the file system library
const Schema = JSON.parse(fs.readFileSync("./services/Orders/orderItemSchema.json", "utf8"));//read the orderItemSchema.json file
const Ajv = require("ajv"); //import the ajv library
const ajv = new Ajv(); // create an ajv object to validate JSON

// const options = {
//     origin:'http://localhost:3000'//allow our frontend to call this backend
// }

// const app = express();//create on express application ~ it's like a constructor 
// const redisClient = Redis.createClient({
//     url:`redis://localhost:6379`
// });

app.use(bodyParser.json());
app.use(cors(options));//allow frontend to call backend

const port = 3001;//this is the port number
app.listen(port, ()=>{
    redisClient.connect();//this connects to the redis database! ! ! ! ! !
    console.log(`API is listening on port: ${port}`);
});//listen for web requests from the front end and don't stop

//Order 
app.post("/order", async (req, res) => {
    let order = req.body;
    //validating properties of order
    if (!order.shippingAddress) {
        res.status(400).send("Missing shippingAddress in the order");
        return;
    }

    try {
        await addOrder({ redisClient, newOrder: order });
        const orderDetails = {
            orderID: order.orderID,
            customerID: order.customerID,
            shippingAddress: order.shippingAddress,
        };

        res.status(200).json({ orderDetails, message: "Order successfully added to Redis" });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

app.get("/orders/:orderID", async (req, res) => {
    //get the order from database
    const orderID = req.params.orderID;
    let order = await getOrder({ redisClient, orderID });
    if (order === null) {
        res.status(404).send("Order not found");
    } else {
        res.json(order);
    }
});

//Order Items

app.post("/orderItems", async (req, res) => {
    try {
      const orderItems = req.body;
  
      // Iterate through order items and add to the database
      for (const orderItem of orderItems) {
        // Modify the addOrderItem function to include orderItem
        await addOrderItem({ redisClient, newOrderItem: orderItem });
      }
  
      res.status(201).json({ message: "Order items added successfully" });
  
    } catch (error) {
      console.error("Error adding order items", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

app.get("/orderItems/:orderItemID", async (re, res) => {
    try {
        const orderItemID = req.params.orderItemId;
        const orderItem = await getOrderItem({ redisClient, orderItemID });
        res.json(orderItem);
    } catch (error) {
        console.error("Error getting order item:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 1. URL
// 2. A function to return boxes
// 3. req = the request from the browser
// 4. res = the response from the browser

//Product
app.post('/products', async (req, res)=>{// async means we will await promises
    try {
        const newProduct = req.body;
        await addProduct({ redisClient, newProduct });
        res.json(newProduct);
    } catch (error) {
        res.sendStatus(500).json({ error: 'Internal server error' });
    }
});

app.get('/products/:productID', async (req, res)=>{
    try {
        const productID = req.params.productID;
        const product = await getProduct({ redisClient, productID });
        if(!product) {
            res.status(404).send('Product not found');
        } else {
            res.json(product);
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error'});
    }
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

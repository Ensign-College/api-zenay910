const Redis = require('redis');
const { addProduct, getProduct } = require("./services/Products/ProductService.js");
const { addOrder, getOrder } = require("./services/Orders/OrderService.js");
const { addOrderItem, getOrderItem } = require("./services/Orders/OrderItems.js");
const fs = require("fs");
const Schema = JSON.parse(fs.readFileSync("./services/Orders/orderItemSchema.json", "utf8"));
const Ajv = require("ajv");
const ajv = new Ajv();

const redisClient = Redis.createClient({
    url:`redis://localhost:6379`
});

exports.handler = async (event, context, callback) => {
    try {
        const path = event.path;
        const method = event.httpMethod;
        let response;

        switch (path) {
            case '/order':
                if (method === 'POST') {
                    const order = JSON.parse(event.body);
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
                
                    } catch (error) {
                        console.error(error);
                        res.status(500).send("Internal server error");
                    }
                    response = { statusCode: 200, body: JSON.stringify({ message: "Order successfully added to Redis" }) };
                } else if (method === 'GET') {
                    const orderID = req.params.orderID;
    let order = await getOrder({ redisClient, orderID });
    if (order === null) {
        res.status(404).send("Order not found");
    } else {
        res.json(order);
    }
                }
                break;
            case '/orderItems':
                // Your orderItems POST and GET logic
                break;
            case '/products':
                // Your products POST and GET logic
                break;
            default:
                response = { statusCode: 404, body: JSON.stringify({ message: "Not Found" }) };
        }

        callback(null, response);
    } catch (error) {
        console.error(error);
        callback({ statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) });
    }
};

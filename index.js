const Redis = require('redis');
const { addOrder, getOrder } = require("./services/Orders/OrderService.js");
const { addOrderItem, getOrderItem } = require("./services/Orders/OrderItems.js");
const { addProduct, getProduct } = require("./services/Products/ProductService.js");

const redisClient = Redis.createClient({
    url:`redis://localhost:6379`
});

exports.test = async (event, context) => {
    event.redisClient = redisClient;
    return {
        statusCode: 200,
        body: JSON.stringify({message: 'WORKS!', event, context})
    }
};

exports.createOrder = async (event, context) => {
    try {
        const order = JSON.parse(event.body);
        // Validating properties of order
        if (!order.shippingAddress) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing shippingAddress in the order" })
            };
        }

        await addOrder({ redisClient, newOrder: order });
        const orderDetails = {
            orderID: order.orderID,
            customerID: order.customerID,
            shippingAddress: order.shippingAddress,
        };

        return {
            statusCode: 200,
            body: JSON.stringify({ orderDetails, message: "Order successfully added to Redis" })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};

exports.getOrderById = async (event, context) => {
    try {
        const orderID = event.pathParameters.orderID;
        console.log('OrderID:', orderID);
        const order = await getOrder({ redisClient, orderID });
        console.log('Retrieved order:', order);
        if (!order) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Order not found" })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify(order)
            };
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Hello, Jeff" })
        };
    }
};

exports.createProduct = async (event, context) => {
    try {
        const newProduct = JSON.parse(event.body);
        await addProduct({ redisClient, newProduct });
        return {
            statusCode: 200,
            body: JSON.stringify(newProduct)
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};

exports.getProductById = async (event, context) => {
    try {
        const productID = event.pathParameters.productID;
        const product = await getProduct({ redisClient, productID });
        if (!product) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Product not found" })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify(product)
            };
        }
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};
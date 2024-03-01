const addOrder = async ({ redisClient, newOrder }) => {
    try {
        const orderKey = `order:${newOrder.orderID}-${Date.now()}`;
        await redisClient.json.set(orderKey, '.', newOrder);
        console.log('Order added successfully to Redis');
    } catch (error) {
        console.error('Error adding order to Redis: ', error);
        throw error;
    }
};

const getOrder = async ({ redisClient, orderID }) => {
    try {
        const order = await redisClient.json.get(orderID);
        return order || null;
    } catch (error) {
        console.error('Error getting order from Redis: ', error);
        throw error;
    }
};

module.exports = { addOrder, getOrder };
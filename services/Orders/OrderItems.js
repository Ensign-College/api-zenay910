const addOrderItem = async ({ redisClient, newOrderItem }) => {
    try {
        const orderItemKey = `orderItem:${newOrderItem.orderItemID}-${Date.now()}`;
        await redisClient.json.set(orderItemKey, ".", newOrderItem);
        console.log('Order Item added successfully to Redis');
    } catch (error) {
        console.error('Error adding order item to Redis: ', error);
        throw error;
    }
};

const getOrderItem = async ({ redisClient, orderItemID }) => {
    try {
        const orderItem = await redisClient.json.get(orderItemID);
        return orderItem || null;
    } catch (error) {
        console.error('Error getting order item from Redis: ', error);
        throw error;
    }
};

module.exports = { addOrderItem, getOrderItem };
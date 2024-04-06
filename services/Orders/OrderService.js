const addOrder = async ({ redisClient, newOrder }) => {
    try {
        // //To create an order with a unique orderID, we need to find the highest orderID in the database, and then do +1 for the new orderID
        // //get all order keys from Redis
        // const orderKeys = await redisClient.keys('order:*');

        // //get the order IDs from the found keys and sort them
        // const orderIDs = orderKeys.map(key => parseInt(key.split(':')[1].split('-')[0]));//get the key, split @ :, get the second part & split that @ -, then get the 1st part
        // orderIDs.sort((a, b) => a - b);

        // //get the highest orderID
        // const highestOrderID = orderIDs.length > 0 ? orderIDs[orderIDs.length - 1] : 100;

        // //set the orderID for the new order (highest orderID + 1)
        // newOrder.orderID = highestOrderID + 1;

        // //To deal with customerIDs, meaning if the customer already exists, or it needs a new ID
        // const customerIDs = await Promise.all(orderKeys.map(async (key) => {
        //     const order = await redisClient.json.get(key);
        //     return order.customerID;
        // }));

        // //finding highest customerID
        // const highestCustomerID = Math.max(...customerIDs, 100);

        // //setting the new customerID
        // newOrder.customerID = highestCustomerID + 1;

        //creating the key etc
        const orderKey = `order:${newOrder.orderID}`; //-${Date.now()}
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
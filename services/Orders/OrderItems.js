const addOrderItem = async ({ redisClient, newOrderItem }) => {
  try {
    //To create an orderItem with a unique orderItemID, we need to find the highest orderItemID in the database, and then do +1 for the new orderItemID
    //get all order keys from Redis
    const orderKeys = await redisClient.keys("orderItem:*");

    //get the orderItem IDs from the found keys and sort them
    const orderItemIDs = orderKeys.map((key) =>
      parseInt(key.split(":")[1].split("-")[0])
    ); //get the key, split @ :, get the second part & split that @ -, then get the 1st part
    orderItemIDs.sort((a, b) => a - b);

    //get the highest orderItemID
    const highestOrderItemID =
      orderItemIDs.length > 0 ? orderItemIDs[orderItemIDs.length - 1] : 0;

    //set the orderID for the new order (highest orderID + 1)
    newOrderItem.orderItemID = highestOrderItemID + 1;

    const orderItemKey = `orderItem:${newOrderItem.orderItemID}-${Date.now()}`;
    await redisClient.json.set(orderItemKey, ".", newOrderItem);
    console.log("Order Item added successfully to Redis");
  } catch (error) {
    console.error("Error adding order item to Redis: ", error);
    throw error;
  }
};

const getOrderItem = async ({ redisClient, orderItemID }) => {
  try {
    const orderItem = await redisClient.json.get(orderItemID);
    return orderItem || null;
  } catch (error) {
    console.error("Error getting order item from Redis: ", error);
    throw error;
  }
};

module.exports = { addOrderItem, getOrderItem };

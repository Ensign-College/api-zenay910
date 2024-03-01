const addProduct = async ({ redisClient, newProduct }) => { 
    try {
        const productKey = `product:${newProduct.productID}-${Date.now()}`;
        await redisClient.json.set(productKey, '.', newProduct);
        console.log('Product added successfully to Redis');
    } catch (error) {
        console.error('Error adding product to Redis: ', error);
        throw error;
    }
};

const getProduct = async ({ redisClient, productID }) => {
    try {
        const product = await redisClient.json.get(productID);
        return product || null;
    } catch (error) {
        console.error('Error getting product from Redis:', error);
        throw error;
    }
};

module.exports = { addProduct, getProduct };
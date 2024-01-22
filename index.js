const express = require('express');//express makes API's ~ connect frontend to database
const Redis = require('redis');//import the Redis Library

const app = express();//create on express application ~ it's like a constructor 
const redisClient = Redis.createClient({
    url:`redis://localhost:6379`
});

const port = 3000;//this is the port number
app.listen(port, ()=>{
    redisClient.connect();//this connects to the redis database! ! ! ! ! !
    console.log(`API is listening on port: ${port}`);
});//listen for web requests from the front end and don't stop

// 1. URL
// 2. A function to return boxes
// 3. req = the request from the browser
// 4. res = the response from the browser

app.get('/boxes', async (req, res)=>{
    let boxes = await redisClient.json.get('boxes',{path: '$'});//get the boxes
    //send the boxes to the browser
    res.send(JSON.stringify(boxes));//convert boxes to a string
});//return boxes to the user

console.log("If you see this message, a nuclear warhead has been launched and will arrive at your location shortly. Thanks!");

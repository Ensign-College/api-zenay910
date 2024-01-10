const express = require('express');//express makes API's ~ connect frontend to database

const app = express();//create on express application ~ it's like a constructor 

app.listen(3000);//listen for web requests from the front end and don't stop

const boxes = [
    {boxID:1},
    {boxID:2},
    {boxID:3},
    {boxID:4},
];

// 1. URL
// 2. A function to return boxes
// 3. req = the request from the browser
// 4. res = the response from the browser

app.get('/boxes', (req, res)=>{
    //send the boxes to the browser
    res.send(JSON.stringify(boxes));//convert boxes to a string
});//return boxes to the user

console.log("If you see this message, a nuclear warhead has been launched and will arrive at your location shortly. Thanks!");

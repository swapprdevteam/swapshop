// var express = require("express");
// var router = express.Router({mergeParams: true});
// var Book = require("../models/book");
// var Comment = require("../models/comment");



//middleware

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
      return next();
  }  
  res.redirect("/login");
}


module.exports = router;
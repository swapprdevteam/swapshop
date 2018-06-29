require('dotenv').config();

var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var Book = require("./models/book");
var Comment = require("./models/comment");
var seedDB = require("./seeds");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var methodOverride = require("method-override");
var User = require("./models/user");
var flash = require("connect-flash");


//////////////////////////
//requiring routes
//////////////////////////
// var commentRoutes = require("./routes/comments");
// var bookRoutes = require("./routes/books");
// var indexRoutes = require("./routes/index");

mongoose.connect("mongodb://localhost/swappr");
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
// seedDB(); //seed the database

app.locals.moment = require('moment');
//////////////////////////
//PASSPORT CONFIGURATION
//////////////////////////
app.use(require("express-session")({
    secret: "Once again rest in peace uncle phil",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

app.get("/", function(req, res){
    res.render("landing");
});

//Google maps goes with book index
var NodeGeocoder = require('node-geocoder');
 
var options = {
  provider: 'google',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);

//////////////////////////
//INDEX - show all books
//////////////////////////
app.get("/books", function(req, res) {
    // Get all books from DB
    Book.find({}, function(err, allBooks){
        if(err){
            console.log(err);
        } else {
             res.render("books/index",{books: allBooks, page: 'books'});
        }
    });
});

///////////////////////////////////
//CREATE - add new book to database
///////////////////////////////////
app.post("/books", isLoggedIn, function(req, res) {
    // get data from form and add to books array
    var name = req.body.name;
    var price = req.body.price;
    var image = req.body.image;
    var desc = req.body.description;
    var author = {
        id: req.user._id,
        username: req.user.username
    }
    geocoder.geocode(req.body.location, function (err, data) {
    if (err || !data.length) {
      req.flash('error', 'Invalid address');
      return res.redirect('back');
    }
    var lat = data[0].latitude;
    var lng = data[0].longitude;
    var location = data[0].formattedAddress;
    var newBook = {name: name, price:price, image: image, description: desc, author:author, location: location, lat: lat, lng: lng};
    //Create a new book and save to DB
    Book.create(newBook, function(err, newlyCreated){
        if(err) {
            console.log(err);
        } else {
            //redirect back to books page
            console.log(newlyCreated);
             res.redirect("/books");
        }
     });
  });

});

////////////////////////////////////
//NEW - show form to create new book
////////////////////////////////////
app.get("/books/new", isLoggedIn, function(req, res) {
    res.render("books/new");
});

//////////////////////////
//SHOW - shows more info about one book
//////////////////////////
app.get("/books/:id", function(req, res){
    //find the book with provided ID
    Book.findById(req.params.id).populate("comments").exec(function(err, foundBook){
        if(err || !foundBook){
            req.flash('error', 'Book not found');
            res.redirect("back");
        } else {
            console.log(foundBook)
            //render show template with that book
            res.render("books/show", {book: foundBook});
        }
    });
});

//////////////////////////
//Comments New
//////////////////////////
app.get("/books/:id/comments/new", isLoggedIn, function(req, res){
    //find book by id
    Book.findById(req.params.id, function(err, book){
        if(err){
            console.log(err);
        } else {
             res.render("comments/new", {book: book});
        }
    });
});

//////////////////////////
//Comments Create
//////////////////////////
app.post("/books/:id/comments",isLoggedIn,function(req, res){
    //lookup book using ID
    Book.findById(req.params.id, function(err, book){
        if(err){
            console.log(err);
            res.redirect("/books");
        } else {
         Comment.create(req.body.comment, function(err, comment){
                if(err){
                    req.flash("error", "Something went wrong");
                    console.log(err);
                } else {
                    //add username and id to comment
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    //save comment
                    comment.save()
                    book.comments.push(comment);
                    req.flash("success", "Successfully created comment");
                    book.save();
                    res.redirect('/books/' + book._id);
                }
             });
        }
    });
});

//Comments edit route
app.get("/books/:id/comments/:comment_id/edit",checkCommentOwnership, function(req, res){
    Book.findById(req.params.id, function(err, foundBook){
       if(err || !foundBook){
           req.flash("error", "Cannot find book");
           return res.redirect("back");
       } 
       Comment.findById(req.params.comment_id, function(err, foundComment){
        if(err){
            res.redirect("back");
        } else {
          res.render("comments/edit", {book_id: req.params.id, comment: foundComment});
        }
      });
  });
    
});

//Comments update route
app.put("/books/:id/comments/:comment_id", checkCommentOwnership, function(req,res){
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
        if(err){
            res.redirect("back");
        } else {
            res.redirect("/books/" + req.params.id);
        }
    });
});

// COMMENTS DESTROY ROUTE
app.delete("/books/:id/comments/:comment_id", checkCommentOwnership, function(req, res){
    //findByIdAndRemove
    Comment.findByIdAndRemove(req.params.comment_id, function(err){
        if(err){
            res.redirect("back");
        } else {
            req.flash("success", "Comment deleted");
            res.redirect("/books/" + req.params.id);
        }
    });
});

////////////////////////////
// Authentication root route
////////////////////////////

//Show register Form
app.get("/register", function(req, res){
   res.render("register", {page: 'register'}); 
});
//Handle Sign Up
app.post("/register", function(req, res){
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            console.log(err);
        return res.render("register", {error: err.message});
}
        passport.authenticate("local")(req, res, function(){ 
            req.flash("success", "Successfully Registered! Welcome to Swappr " + user.username);
            res.redirect("/books");
        });
    });
});

//show login form
app.get("/login", function(req, res){
   res.render("login", {page: 'login'}); 
});

//Handling Login
app.post("/login", passport.authenticate("local", 
    {
    successRedirect: "/books",
    failureRedirect: "/login"
    }), function(req, res){
});

//Logout Route
app.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "Logged out");
    res.redirect("/books");
});

///////////////////////
//Edit Book Route
///////////////////////
app.get("/books/:id/edit", checkBookOwnership, function(req, res){
    Book.findById(req.params.id, function(err, foundBook){
        res.render("books/edit", {book: foundBook});
    });
});    
//switch to router.get("/:id/edit")

////////////////////////////////
//Update Book Route
///////////////////////////////

app.put("/books/:id",checkBookOwnership, function(req, res){
     geocoder.geocode(req.body.location, function (err, data) {
    if (err || !data.length) {
      req.flash('error', 'Invalid address');
      return res.redirect('back');
    }
    req.body.book.lat = data[0].latitude;
    req.body.book.lng = data[0].longitude;
    req.body.book.location = data[0].formattedAddress;
    //find and update the correct book
    Book.findByIdAndUpdate(req.params.id, req.body.book, function(err, updatedBook){
         if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            req.flash("success","Successfully Updated!");
            res.redirect("/books/" + req.params.id);
        }
    });
  });
});

////////////////////////////////
//Destroy Book Route
///////////////////////////////
app.delete("/books/:id",checkBookOwnership, function(req, res){
    Book.findByIdAndRemove(req.params.id, function(err){
        if(err){
            res.redirect("/books");
        } else {
            res.redirect("/books");
        }
    });
});


//middleware
function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
      return next();
  }
  req.flash("error", "Please Log In First");
  res.redirect("/login");
}

function checkBookOwnership(req, res, next) {
    if(req.isAuthenticated()){
        Book.findById(req.params.id, function(err, foundBook){
      if(err){
          req.flash("error", "Book not found");
         res.redirect("back");
            } else {
                 //If user is logged in does user own the book post?
                 if(foundBook.author.id.equals(req.user._id)) {
                     next();
                 } else {
                    req.flash("error", "You don't have permission to do that"); 
                    res.redirect("back"); 
                }
              }
         });
            } else {
                req.flash("error", "Please Log In First");
                res.redirect("back");
            }
}

function checkCommentOwnership(req, res, next) {
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err, foundComment){
      if(err || !foundComment){
         req.flash("error","Comment not found");
         res.redirect("back");
            } else {
                 //If user owns the comment
                 if(foundComment.author.id.equals(req.user._id)) {
                     next();
                 } else {
                     req.flash("error", "You don't have permission to do that");
                    res.redirect("back"); 
                 }
              }
         });
            } else {
                
                res.redirect("back");
            }
}

// app.use("/", indexRoutes); 
// app.use("/books", bookRoutes);
// app.use("/books/:id/comments", commentRoutes);

app.listen(process.env.PORT, process.env.IP, function(){
    console.log("Swappr App Server Has Started");
});
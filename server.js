
import express from "express";
import axios from "axios"; 
import bodyParser from "body-parser"; 
import pg from "pg" 
import methodOverride from "method-override";

//Create an express app and set the port number.
const app = express();
const port = 3000;
const API_URL = "https://covers.openlibrary.org/b/isbn"; //External API

// To use other HTTP methods (such as PUT, PATCH, and DELETE) for updating and deleting resources,

app.use(methodOverride('_method')); // the method-override middleware allows overriding the method using a query parameter or a form field.

//Proving connection to database 

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "DB-Name",
    password: "DB-Password",
    port: 5432,
  });
  
  // connecting to database and error handling 
  db.connect(err => {
    if (err) {
        console.error('Failed to connect to the database:', err.stack);
    } else {
        console.log('Connected to the database');
    }
});

app.use(express.static("public")); //setting file as static
app.use(bodyParser.urlencoded({ extended: true }));

// Simple function to convert Date

function convertToDate(dateString){
    
  let dateWithTime = new Date(`${dateString}`);
  var dateWithoutTime = dateWithTime.toISOString().split('T')[0];
  return dateWithoutTime;
}

// GET request from client to show home page for website

app.get("/", async (req, res) => {

  // Extracting query parameters for ordering, pagination, and search

  var orderBy = req.query.orderBy;
  var orderDirection = "DESC"; // Default order direction
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
  const pageSize = 4; //no.of books per page
  const search = req.query.search ? req.query.search.toLowerCase() : ''; // Convert search query to lowercase


  // Validate and set the 'orderBy' parameter
  
  if (!orderBy) 
  {  
    orderBy = "rating";
  }
  else {
    if (!["title", "date_read", "rating"].includes(orderBy)) 
    { 
      orderBy = "rating";
    } 
    else if (orderBy === "title") {
      orderDirection = "ASC";
    }
  }

    var books = [];
    var bookcovers = [];

    // Base query for counting total books and retrieving books

    let totalBooksQuery = `SELECT COUNT(*) FROM book `;

    let bookQuery = `SELECT book.id, isbn, title, date_read, rating, notes 
                    FROM book 
                    JOIN book_review 
                    ON book.id = book_review.id `;
 
    // Adding search condition to search the books
    if (search) {
      totalBooksQuery += `WHERE LOWER(title) LIKE '%${search}%'`;
      bookQuery += `WHERE LOWER(title) LIKE '%${search}%'`;
    }

    bookQuery += `ORDER BY ${orderBy} ${orderDirection} LIMIT $1 OFFSET $2`;
 
    const totalBookResult = await db.query('SELECT COUNT(*) FROM book');
    const totalBook = parseInt(totalBookResult.rows[0].count);
    const totalPages = Math.ceil(totalBook / pageSize);

    const result = await db.query(bookQuery, [pageSize, (page - 1)* pageSize]);

    books = result.rows; //storing retrived books

    // Fetch book covers for each book
    for (var i = 0; i < books.length; i++) 
    {
        books[i].date_read = convertToDate(books[i].date_read); // Convert date to readable format
        var isbn = books[i].isbn;
        
        // Fetch book cover image from the external API and storing the image and error handling
        try {
            var image = await axios.get(`${API_URL}/${isbn}-M.jpg`);
            if (image) {
                bookcovers.push(`${API_URL}/${isbn}-M.jpg`);
            } 
        }
        catch (error) {
            bookcovers.push(`Cover for ${book[i].title} unavailable`);
        }
    }

    // Render the index.ejs template with the retrieved data
    res.render("index.ejs", { 
        books: books, 
        bookcovers: bookcovers,
        currentPage: page,
        totalPages: totalPages,
        orderBy: orderBy
    });
  });

  // Route to render a form for adding a new book note

  app.get("/new", (req, res) => {
    res.render("book.ejs", {
        heading: "Add New Note", 
        submit: "Add"
    });
  });
  
// GET a specific book by id for editing

  app.get("/edit/:id", async (req, res) => {
    const result = await db.query(
        `SELECT book.id, isbn, title, date_read, rating, notes 
        FROM book
        JOIN book_review 
        ON book.id = book_review.id 
        WHERE book.id = ($1)
        ORDER BY rating ASC`, [parseInt(req.params.id)]
    );
    
    var book = result.rows[0];
    
    if (!book) {
        return res.render("error.ejs", { 
            message: "Error finding book note."
        });
    }
    
    book.date_read = convertToDate(book.date_read);
    res.render("book.ejs", {
        heading: "Edit Note", 
        submit: "Update", 
        book: book
    });
  });
  
  // Add a new book note

  app.post("/booknotes", async (req, res) => {
    const book_insert = await db.query(
        `INSERT INTO book (title, isbn) VALUES ($1, $2) RETURNING id;`, [req.body.title, req.body.isbn]
    );
    
    const book_review_insert = await db.query(
        `INSERT INTO book_review (id, date_read, rating, notes) 
        VALUES ($1, $2, $3, $4)`, 
        [book_insert.rows[0].id, req.body.date_read, parseInt(req.body.rating), req.body.notes]
    );
    
    if (!book_insert || !book_review_insert) {
        return res.render("error.ejs", {
            message: "Error adding in new book note."
        });
    }
    res.redirect("/");
  });
  
  
  // Update the book note

  app.post("/booknotes/:id", async (req, res) => {
    var book_id = parseInt(req.params.id);
    const result = await db.query(
        `SELECT book.id, isbn, title, date_read, rating, notes 
        FROM book
        JOIN book_review 
        ON book.id = book_review.id 
        WHERE book.id = ($1)
        ORDER BY rating ASC`, [book_id]
    );
    
    var book = result.rows[0];
    
    if (!book) {
        return res.render("error.ejs", { 
            message: "Error in updating book notes."
        });
    }
    
    if (req.body.notes) book.notes = req.body.notes;
    if (req.body.rating) book.rating = req.body.rating;
    if (req.body.date_read) book.date_read = req.body.date_read;
    
    const book_update = await db.query(
        `UPDATE book_review 
        SET notes = ($1), rating = ($2), date_read = ($3) 
        WHERE book_review.id = ($4)`, [book.notes, book.rating, book.date_read, book_id]
    );

    if (!book_update) { 
        return res.render("error.ejs", { 
            message: "Error updating book note."
        });
    }
    res.redirect("/");
  });
  
  app.get("/delete/:id", async (req, res) => {

    const bookreview_delete = await db.query(
        `DELETE FROM book_review
        WHERE book_review.id IN (SELECT id FROM book WHERE id = ($1));`, [parseInt(req.params.id)]
    );
    
    const book_delete = await db.query(
        `DELETE FROM book WHERE book.id = ($1)`, [parseInt(req.params.id)]
    );
    
    console.log(bookreview_delete);
    console.log(book_delete);
    
    if (!book_delete || !bookreview_delete) {
        return res.render("error.ejs", { 
            message: "Error deleting book note."
        });
    }
    res.redirect("/");
  });
  
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
 });

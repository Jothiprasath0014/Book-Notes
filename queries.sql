
-- Necessary SQL Queries to do.

DROP TABLE IF EXISTS books, book_review;

-- creating a table book to store book detail

CREATE TABLE book (
  id SERIAL PRIMARY KEY,
  title TEXT,
  isbn CHAR(20)
);

-- creating a table book_review to store user-reviews

CREATE TABLE book_review (
  id INTEGER REFERENCES book(id) UNIQUE,
  date_read DATE,
  rating SMALLINT,
  notes TEXT
);

-- Insert some values to book table

INSERT INTO book (title, isbn)
VALUES ('I Dont Love You Anymore', '9780143469131'), ('Control Your Mind and Master Your Feelings' , '9781691706631');

-- Insert some values to book_review table

INSERT INTO book_review (id, date_read, rating, notes)
VALUES (1, '2024-07-20', 7, 'A Book that feels like a warm hug.'), (2, '2018-02-21', 7, 'A good book this book includes how to Break Overthinking & Master our Emotions');

-- Join the tables (one-one relation)

SELECT book.id, isbn, title, date_read, rating, notes
FROM book
JOIN book_review
ON book.id = book_review.id
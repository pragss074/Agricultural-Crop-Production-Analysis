import os
import mysql.connector


def get_connection():
    """Connect to the local MySQL database.

    Set MYSQL_PASSWORD in your environment, or replace the fallback below
    with your local password for private local development only.
    """
    password = os.getenv("MYSQL_PASSWORD", "YOUR_MYSQL_PASSWORD")

    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=password,
        database=os.getenv("MYSQL_DATABASE", "agricultural_crop_db")
    )


if __name__ == "__main__":
    connection = get_connection()
    print("MySQL connected successfully!")
    connection.close()

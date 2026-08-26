import bcrypt

password = b"admin123"
hashed = bcrypt.hashpw(password, bcrypt.gensalt(10))
print(hashed.decode('utf-8'))

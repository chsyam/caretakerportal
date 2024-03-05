const bcrypt = require('bcrypt');
const { register_caretaker } = require('../../auth'); // Adjust the path according to your project structure
const { Caretaker } = require('../../database');

// Mock bcrypt and Caretaker model
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));
jest.mock('../../database', () => ({
  Caretaker: {
    create: jest.fn(),
  }
}));

describe('register_caretaker', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    Caretaker.create.mockClear();
    bcrypt.hash.mockClear();
  });

  it('should redirect to login on successful registration', async () => {
    // Setup
    const req = {
      body: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'johndoe@example.com',
        password: 'password123'
      }
    };
    const res = {
      redirect: jest.fn()
    };

    bcrypt.hash.mockResolvedValue('hashedpassword123');
    Caretaker.create.mockResolvedValue({});

    // Action
    await register_caretaker(req, res);

    // Assert
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(Caretaker.create).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      email: 'johndoe@example.com',
      password: 'hashedpassword123'
    });
    expect(res.redirect).toHaveBeenCalledWith('login');
  });

  it('should render the registration page with an error message on failure', async () => {
    // Setup
    const req = {
      body: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'johndoe@example.com',
        password: 'password123'
      }
    };
    const res = {
      render: jest.fn()
    };

    // Simulate throwing an error when trying to hash the password or create the user
    bcrypt.hash.mockRejectedValue(new Error('Hashing error'));
    // or Caretaker.create.mockRejectedValue(new Error('Database error'));

    // Action
    await register_caretaker(req, res);

    // Assert
    expect(res.render).toHaveBeenCalledWith('register', { message: "An error occurred" });
  });

  // Add more test cases as needed
});

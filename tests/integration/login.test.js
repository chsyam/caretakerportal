const bcrypt = require('bcrypt');
const { login_caretaker } = require('../../auth'); 
const { Caretaker } = require('../../database');

// Mock bcrypt and Caretaker model
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));
jest.mock('../../database', () => ({
  Caretaker: {
    findOne: jest.fn(),
  }
}));

describe('login_caretaker', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    Caretaker.findOne.mockClear();
    bcrypt.compare.mockClear();
  });

  it('should respond with "Invalid Credentials" for invalid credentials', async () => {
    // Setup
    const req = {
      body: {
        email: 'susan@gmail.com',
        password: '$2b$10$bN8uIbW3bUzaZpu1bV.Q4OpVBWyfXhjKIfx8lFmf1PSrf7QlOCmjS'
      }
    };
    const res = {
      render: jest.fn(),
      redirect: jest.fn()
    };

    Caretaker.findOne.mockResolvedValue({
      id: '1327bcb0-bab1-425c-a8e4-fd163b586f32',
      email: 'susan@gmail.com',
      password: '$2b$10$bN8uIbW3bUzaZpu1bV.Q4OpVBWyfXhjKIfx8lFmf1PSrf7QlOCmjS'
    });
    bcrypt.compare.mockResolvedValue(false);

    // Action
    await login_caretaker(req, res);

    // Assert
    expect(res.render).toHaveBeenCalledWith('login', { message: "Invalid Credentials" });
    // Ensure redirect wasn't called
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('should redirect to profile on successful login', async () => {
    // Setup
    const req = {
      body: {
        email: 'susan@gmail.com',
        password: 'susan123'
      },
      session: {}
    };
    const res = {
      redirect: jest.fn()
    };
  
    Caretaker.findOne.mockResolvedValue({
      id: '1327bcb0-bab1-425c-a8e4-fd163b586f32',
      email: 'susan@gmail.com',
      password: '$2b$10$bN8uIbW3bUzaZpu1bV.Q4OpVBWyfXhjKIfx8lFmf1PSrf7QlOCmjS'
    });
    bcrypt.compare.mockResolvedValue(true);
  
    // Action
    await login_caretaker(req, res);
  
    // Assert
    expect(bcrypt.compare).toHaveBeenCalledWith('susan123', '$2b$10$bN8uIbW3bUzaZpu1bV.Q4OpVBWyfXhjKIfx8lFmf1PSrf7QlOCmjS');
    expect(res.redirect).toHaveBeenCalledWith('profile');
  });

  it('should respond with "An error occurred" message on exception', async () => {
    // Setup
    const req = {
      body: {
        email: 'susan@gmail.com',
        password: '$2b$10$bN8uIbW3bUzaZpu1bV.Q4OpVBWyfXhjKIfx8lFmf1PSrf7QlOCmjS'
      }
    };
    const res = {
      render: jest.fn()
    };
  
    // Simulate throwing an error when trying to find the caretaker
    Caretaker.findOne.mockRejectedValue(new Error('Database error'));
  
    // Action
    await login_caretaker(req, res);
  
    // Assert
    expect(res.render).toHaveBeenCalledWith('login', { message: "An error occurred" });
  });
  
  
});

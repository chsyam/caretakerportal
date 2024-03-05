const supertest = require("supertest");
const server = require("../../server");
const request = supertest(server);
const {
  CabinetBox,
  Patient,
  Caretaker,
  Cabinet,
  Schedule,
  Session,
  sequelize
} = require("../../database");

const { getAllPatients } = require("../../methods");



jest.mock("../../database", () => ({
    Patient: {
      findAll: jest.fn(),
    },
    Caretaker: {
      // mock other models as needed
    },
  }));

describe('getAllPatients', () => {
 
  
    it('should fetch all patients with their associated caretaker information', async () => {
      // Mock data
      const mockPatientsData = [
        {
          toJSON: () => ({
            id: 'patient1',
            name: 'John Doe',
            Caretaker: {
              first_name: 'Jane',
              last_name: 'Doe',
            }
          })
        },
        {
          toJSON: () => ({
            id: 'patient2',
            name: 'Richard Roe',
            Caretaker: {
              first_name: 'Janet',
              last_name: 'Roe',
            }
          })
        }
      ];
  
      // Setup mock implementation
      Patient.findAll.mockResolvedValue(mockPatientsData);
  
      // Call the method
      const result = await getAllPatients();
  
      // Assertions
      expect(Patient.findAll).toHaveBeenCalledWith({
        include: [{
          model: Caretaker, attributes: ['first_name', 'last_name']
        }]
      });
      expect(result).toEqual([
        {
          id: 'patient1',
          name: 'John Doe',
          caretaker_first_name: 'Jane',
          caretaker_last_name: 'Doe',
        },
        {
          id: 'patient2',
          name: 'Richard Roe',
          caretaker_first_name: 'Janet',
          caretaker_last_name: 'Roe',
        }
      ]);
    });
  
    it('should handle errors', async () => {
      // Setup mock implementation to throw an error
      Patient.findAll.mockRejectedValue(new Error('Database Error'));
  
      await expect(getAllPatients()).rejects.toThrow('Database Error');
    });
  });
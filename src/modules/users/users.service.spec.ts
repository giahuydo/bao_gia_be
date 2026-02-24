import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from '../../database/entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_ID = 'user-uuid-1';
const ANOTHER_USER_ID = 'user-uuid-2';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: 'user@example.com',
    password: 'hashed-password-should-not-be-returned',
    fullName: 'Nguyen Van A',
    role: UserRole.SALES,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    customers: [],
    products: [],
    quotations: [],
    templates: [],
    ...overrides,
  }) as User;

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return all users with selected fields (no password)', async () => {
      const users = [
        makeUser(),
        makeUser({ id: ANOTHER_USER_ID, email: 'admin@example.com', role: UserRole.ADMIN }),
      ];
      mockRepo.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith({
        select: ['id', 'email', 'fullName', 'role', 'isActive', 'createdAt', 'updatedAt'],
      });
      expect(result).toHaveLength(2);
    });

    it('should explicitly select specific fields to exclude the password field', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.findAll();

      const callArgs = mockRepo.find.mock.calls[0][0];
      expect(callArgs.select).toContain('id');
      expect(callArgs.select).toContain('email');
      expect(callArgs.select).toContain('fullName');
      expect(callArgs.select).toContain('role');
      expect(callArgs.select).toContain('isActive');
      expect(callArgs.select).not.toContain('password');
    });

    it('should return an empty array when no users exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should return users with different roles', async () => {
      const users = [
        makeUser({ role: UserRole.ADMIN }),
        makeUser({ id: ANOTHER_USER_ID, role: UserRole.MANAGER }),
        makeUser({ id: 'user-uuid-3', role: UserRole.SALES }),
      ];
      mockRepo.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
      expect(result.map((u) => u.role)).toEqual([
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.SALES,
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a user when found by id', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne(USER_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: USER_ID } });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should look up user by the exact provided id', async () => {
      const user = makeUser({ id: ANOTHER_USER_ID });
      mockRepo.findOne.mockResolvedValue(user);

      await service.findOne(ANOTHER_USER_ID);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: ANOTHER_USER_ID } });
    });
  });

  describe('update', () => {
    it('should update user fields and return the saved entity', async () => {
      const existing = makeUser({ fullName: 'Old Name', role: UserRole.SALES });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = { fullName: 'New Name' };
      const updated = { ...existing, ...updateDto };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(USER_ID, updateDto);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'New Name' }),
      );
      expect(result.fullName).toBe('New Name');
    });

    it('should update user role from sales to admin', async () => {
      const existing = makeUser({ role: UserRole.SALES });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = { role: UserRole.ADMIN };
      mockRepo.save.mockResolvedValue({ ...existing, role: UserRole.ADMIN });

      const result = await service.update(USER_ID, updateDto);

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should update user role from sales to manager', async () => {
      const existing = makeUser({ role: UserRole.SALES });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = { role: UserRole.MANAGER };
      mockRepo.save.mockResolvedValue({ ...existing, role: UserRole.MANAGER });

      const result = await service.update(USER_ID, updateDto);

      expect(result.role).toBe(UserRole.MANAGER);
    });

    it('should toggle isActive from true to false', async () => {
      const existing = makeUser({ isActive: true });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = { isActive: false };
      mockRepo.save.mockResolvedValue({ ...existing, isActive: false });

      const result = await service.update(USER_ID, updateDto);

      expect(result.isActive).toBe(false);
    });

    it('should toggle isActive from false to true', async () => {
      const existing = makeUser({ isActive: false });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = { isActive: true };
      mockRepo.save.mockResolvedValue({ ...existing, isActive: true });

      const result = await service.update(USER_ID, updateDto);

      expect(result.isActive).toBe(true);
    });

    it('should preserve unchanged fields during update', async () => {
      const existing = makeUser({
        email: 'original@email.com',
        role: UserRole.MANAGER,
        isActive: true,
      });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = { fullName: 'Only Name Changed' };
      mockRepo.save.mockResolvedValue({ ...existing, fullName: 'Only Name Changed' });

      const result = await service.update(USER_ID, updateDto);

      expect(result.email).toBe('original@email.com');
      expect(result.role).toBe(UserRole.MANAGER);
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException when updating a non-existent user', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateUserDto = { fullName: 'Does Not Matter' };

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update multiple fields in a single call', async () => {
      const existing = makeUser({ fullName: 'Old Name', role: UserRole.SALES, isActive: true });
      mockRepo.findOne.mockResolvedValue(existing);

      const updateDto: UpdateUserDto = {
        fullName: 'New Name',
        role: UserRole.ADMIN,
        isActive: false,
      };
      const updated = { ...existing, ...updateDto };
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(USER_ID, updateDto);

      expect(result.fullName).toBe('New Name');
      expect(result.role).toBe(UserRole.ADMIN);
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    it('should deactivate a user by setting isActive to false', async () => {
      const user = makeUser({ isActive: true });
      mockRepo.findOne.mockResolvedValue(user);

      await service.remove(USER_ID);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should throw NotFoundException when removing a non-existent user', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.remove('non-existent-id')).rejects.toThrow('User not found');
    });

    it('should return void on successful deactivation', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.remove(USER_ID);

      expect(result).toBeUndefined();
    });

    it('should NOT hard-delete the user record', async () => {
      const user = makeUser();
      mockRepo.findOne.mockResolvedValue(user);
      const deleteMock = jest.fn();
      mockRepo.delete = deleteMock;

      await service.remove(USER_ID);

      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('should save the user entity after setting isActive to false', async () => {
      const user = makeUser({ isActive: true });
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockResolvedValue({ ...user, isActive: false });

      await service.remove(USER_ID);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }));
    });
  });
});

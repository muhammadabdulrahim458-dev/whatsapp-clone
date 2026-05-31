// server/repositories/user.repository.js
const User = require('../models/User.model');
const bcrypt = require('bcryptjs');

class UserRepository {
  async findByEmail(email) {
    return await User.findOne({ email });
  }

  async findByEmailWithPassword(email) {
    return await User.findOne({ email }).select('+password');
  }

  async findById(id, selectPassword = false) {
    let query = User.findById(id);
    if (selectPassword) query = query.select('+password');
    return await query;
  }

  async findByUsername(username) {
    return await User.findOne({ username });
  }

  async searchUsersExact(query, excludeUserId, limit = 10) {
    return await User.find({
      $and: [
        { _id: { $ne: excludeUserId } },
        {
          $or: [
            { username: { $regex: `^${query}$`, $options: 'i' } },
            { email: { $regex: `^${query}$`, $options: 'i' } },
          ],
        },
      ],
    })
      .select('-password')
      .limit(limit);
  }

  async create(userData) {
    const user = new User(userData);
    await user.save();
    return user;
  }

  async updateUser(id, updateData) {
    return await User.findByIdAndUpdate(id, updateData, { new: true });
  }

  async updateProfile(userId, updates) {
    const user = await this.findById(userId);
    if (!user) return null;
    if (updates.username) user.username = updates.username;
    if (updates.email) user.email = updates.email;
    await user.save();
    return user;
  }

  async updateAvatar(userId, avatarPath) {
    return await User.findByIdAndUpdate(userId, { avatar: avatarPath }, { new: true });
  }

  async updateOnlineStatus(userId, isOnline) {
    await User.findByIdAndUpdate(userId, { isOnline });
  }

  async findAllOnline() {
    return await User.find({ isOnline: true }).select('_id');
  }

  async resetAllOffline() {
    await User.updateMany({}, { isOnline: false });
  }

  async checkPassword(user, plainPassword) {
    return await bcrypt.compare(plainPassword, user.password);
  }
}

module.exports = new UserRepository();
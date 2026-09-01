require('dotenv').config();
const mongoose = require('mongoose');

async function upgradeUser0009() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Find the 9th user by _id
  const users = await mongoose.connection.collection('users').find().sort({ _id: 1 }).skip(8).limit(1).toArray();
  
  if (users.length > 0) {
    const user = users[0];
    console.log(`Found 9th user: ${user._id} (email/phone: ${user.email || user.phone})`);
    
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await mongoose.connection.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionPlan: 'premium',
          subscriptionExpiry: expiryDate
        }
      }
    );
    console.log('User upgraded successfully to Premium.');
  } else {
    console.log('Could not find a 9th user in the database.');
  }

  await mongoose.disconnect();
}

upgradeUser0009().catch(console.error);

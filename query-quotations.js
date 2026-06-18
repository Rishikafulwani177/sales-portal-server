const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://at16:123465@ac-xtipuhk-shard-00-00.il8ggcw.mongodb.net:27017,ac-xtipuhk-shard-00-01.il8ggcw.mongodb.net:27017,ac-xtipuhk-shard-00-02.il8ggcw.mongodb.net:27017/?ssl=true&replicaSet=atlas-bti92b-shard-0&authSource=admin&appName=Cluster0';

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get the database collections or list documents from 'salesdocuments'
    const SalesDocument = mongoose.connection.collection('salesdocuments');
    
    // Find the latest document
    const docs = await SalesDocument.find({}).sort({ createdAt: -1 }).limit(3).toArray();
    
    console.log('Found documents:', docs.length);
    for (const doc of docs) {
      console.log('--- Document:', doc.documentNumber || doc.quoteNumber, doc.type);
      console.log('Customer:', doc.customerName);
      console.log('Items:', JSON.stringify(doc.items, null, 2));
      console.log('------------------------------------');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();

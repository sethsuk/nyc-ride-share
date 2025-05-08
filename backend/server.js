const app = require('./src/app');

const PORT = process.env.PORT || 5050;

app.get('/', (req, res) => {
  res.send('Welcome to NYC Ride Share!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
  
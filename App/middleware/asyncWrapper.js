module.exports = (asyncFn) => { // asyncFn is the async route handler
  return (req, res, next) => {
    asyncFn(req, res, next).catch((err) => {
      next(err);
    });
  };
};


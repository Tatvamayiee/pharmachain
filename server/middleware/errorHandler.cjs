function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';
  if (err.type === 'entity.parse.failed') {
    console.warn('[Request] Rejected malformed JSON body');
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  console.error('[Error]', err.name, err.message);

  if (err.name === 'ValidationError' || err.isJoi) {
    return res.status(422).json({ error: 'Validation Failed', details: err.message });
  }

  const status = err.status || 500;
  const message = status === 500 && !isDev ? 'Internal Server Error' : err.message;
  
  res.status(status).json({
    error: message,
    ...(isDev && status === 500 ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;

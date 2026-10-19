const z = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query);
      if (schema.params) req.params = schema.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(422).json({
          error: 'Validation Failed',
          details: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      next(err);
    }
  };
}

module.exports = validate;


const Joi = require('joi');

const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = source === 'body' ? req.body : source === 'query' ? req.query : req.params;

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace req body/query/params with validated values
    if (source === 'body') req.body = value;
    else if (source === 'query') req.query = value;
    else if (source === 'params') req.params = value;

    next();
  };
};

module.exports = validateRequest;

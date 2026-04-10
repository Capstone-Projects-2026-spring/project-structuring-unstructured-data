let mongoose;
try {
  mongoose = require('mongoose');
} catch (_error) {
  // Render may install dependencies only under bolt_slack in this monorepo.
  mongoose = require('../../bolt_slack/node_modules/mongoose');
}

const workspaceTokenSchema = new mongoose.Schema({
  team_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  team_name: {
    type: String,
    required: true
  },
  access_token: {
    type: String,
    required: true
  },
  bot_user_id: {
    type: String,
    required: true
  },
  installed_at: {
    type: Date,
    default: Date.now
  },
  last_used: {
    type: Date,
    default: Date.now
  }
});

// Update last_used timestamp on every query
workspaceTokenSchema.pre('findOne', function() {
  this.exec = (function(originalExec) {
    return function() {
      return originalExec.apply(this, arguments).then(doc => {
        if (doc) {
          doc.last_used = new Date();
          return doc.save();
        }
        return doc;
      });
    };
  })(this.exec);
});

const WorkspaceToken = mongoose.model('WorkspaceToken', workspaceTokenSchema);

module.exports = WorkspaceToken;

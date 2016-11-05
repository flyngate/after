;(function (module) {
  module && (module.exports = after) || (this.after = after);

  function after(f) {
    var defer = after.deferred();
    f(defer.resolve, defer.reject);
    return defer.promise;
  }

  after.resolve = function (value) {
    return resolvePromise(new PromiseObject(), value);
  }

  after.reject = function (reason) {
    return rejectPromise(new PromiseObject(), reason);
  }

  after.deferred = function () {
    let promise = new PromiseObject();
    return {
      promise: promise,
      resolve: function (value) {
        resolvePromise(promise, value);
      },
      reject: function (reason) {
        rejectPromise(promise, reason);
      }
    }
  }

  function PromiseObject() {
    this.state = State.pending;
    this.value = undefined;
    this.callbacks = [];
  }

  PromiseObject.prototype.then = function (onResolve, onReject) {
    const childPromise = new PromiseObject();
    this.callbacks.push({ onResolve, onReject, childPromise });
    if (this.state != State.pending) {
      runCallbacksAsync(this);
    }
    return childPromise;
  };

  PromiseObject.prototype.catch = function (onReject) {
    return this.then(null, onReject);
  };

  function runCallbacksAsync(promise) {
    if (promise.callbacks) {
      setTimeout(partial(runCallbacks, promise));
    }
  }

  function runCallbacks(promise) {
    let callbacks = promise.callbacks.slice();
    promise.callbacks = [];
    callbacks.forEach(({onResolve, onReject, childPromise}) => {
      try {
        if (isResolved(promise)) {
          tryCallback(promise, childPromise, onResolve);
        }
        if (isRejected(promise)) {
          tryCallback(promise, childPromise, onReject);
        }
        if (isPending(promise)) {
          promise.callbacks.push({onResolve, onReject, childPromise})
        }
      } catch (reason) {
        rejectPromise(childPromise, reason);
      }
    });
  };

  function tryCallback(promise, childPromise, cb) {
    if (typeof cb == 'function') {
      const foreignValue = cb(promise.value);
      if (foreignValue === childPromise) {
        throw new TypeError('Chaining cycle detected for promise', promise);
      }
      flattenPromiseOrValue(
        foreignValue,
        partial(resolvePromise, childPromise),
        partial(rejectPromise, childPromise)
      );
    } else {
      changePromiseState(childPromise, promise.state, promise.value);
    }
  }

  function flattenPromiseOrValue(value, resolve, reject) {
    let fulfill = (method, value) => method(value);
    let waitingForValue = false;
    try {
      let thenFunction = canBeThenable(value) && value.then;
      if (value && typeof thenFunction == 'function') {
        thenFunction.call(value, once((valueFromPromise) => {
          waitingForValue = true;
          flattenPromiseOrValue(valueFromPromise, resolve, reject);
        }), once(partial(fulfill, reject)));
      } else {
        fulfill(resolve, value);
      }
    } catch (reason) {
      if (! waitingForValue) {
        fulfill(reject, reason);
      }
    }
  }

  function canBeThenable(value) {
    return (value !== undefined) && (value !== null) &&
      (typeof value != 'boolean') && (typeof value != 'number');
  }

  function resolvePromise(promise, value) {
    return changePromiseState(promise, State.resolved, value);
  }

  function rejectPromise(promise, reason) {
    return changePromiseState(promise, State.rejected, reason);
  }

  function changePromiseState(promise, state, value) {
    if (isPending(promise)) {
      promise.state = state;
      promise.value = value;
      runCallbacksAsync(promise);
    }
    return promise;
  }

  function isResolved(promise) {
    return promise.state == State.resolved;
  }

  function isRejected(promise) {
    return promise.state == State.rejected;
  }

  function isPending(promise) {
    return promise.state == State.pending;
  }

  var State = {
    pending: 'pending',
    resolved: 'resolved',
    rejected: 'rejected'
  }

  function once(f) {
    let calledTimes = 0;
    return (...args) => {
      if (calledTimes < 1) {
        f(...args);
        ++calledTimes;
      }
    }
  }

  function partial(f, ...argsStart) {
    return (...argsEnd) => f(...argsStart.concat(argsEnd));
  }
})(module);

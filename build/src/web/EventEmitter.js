"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SyntheticEvent {
    constructor(type) {
        this.type = type;
        this.defaultPrevented = false;
    }
    preventDefault() {
        this.defaultPrevented = true;
    }
    static create(type, data) {
        let e = new SyntheticEvent(type);
        return data ? Object.assign(e, data) : e;
    }
}
exports.SyntheticEvent = SyntheticEvent;
class EventEmitter {
    constructor(config) {
        this._eventListenerPool = Object.create(null);
        this._eventLifeCycleHooks = config && config.hooks ? config.hooks : {};
    }
    on(eventType, listener) {
        let pool = this._eventListenerPool;
        let fnSet = pool[eventType];
        if (!fnSet) {
            fnSet = new Set();
            pool[eventType] = fnSet;
        }
        if (fnSet.size === 0) {
            let hook = this._eventLifeCycleHooks[eventType];
            if (hook)
                hook.init();
        }
        fnSet.add(listener);
        return this;
    }
    un(eventType, listener) {
        let pool = this._eventListenerPool;
        let fnSet = pool[eventType];
        if (fnSet) {
            let has = fnSet.delete(listener);
            if (fnSet.size === 0 && has) {
                let hook = this._eventLifeCycleHooks[eventType];
                if (hook)
                    hook.clear();
            }
        }
        return this;
    }
    emit(eventType, data) {
        let pool = this._eventListenerPool;
        let fnSet = pool[eventType];
        if (!fnSet) {
            return true;
        }
        let event = SyntheticEvent.create(eventType, data);
        for (let f of fnSet) {
            f(event);
        }
        return !event.defaultPrevented;
    }
    clear(eventType) {
        delete this._eventListenerPool[eventType];
        let hook = this._eventLifeCycleHooks[eventType];
        if (hook)
            hook.clear();
        return this;
    }
}
exports.EventEmitter = EventEmitter;
//# sourceMappingURL=EventEmitter.js.map
/*
The MIT License (MIT)
Copyright (c) 2014 Joel Takvorian, https://github.com/jotak/mipod
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
* Overrides content of 'receiver' with 'provider'
*/
export function override<T>(receiver: T, provider: T) {
    for (var prop in provider) {
        if ({}.hasOwnProperty.call(provider, prop)) {
            if ({}.hasOwnProperty.call(receiver, prop)) {
                if (typeof provider[prop] === 'object') {
                    this.override(receiver[prop], provider[prop]);
                } else {
                    receiver[prop] = provider[prop];
                }
            } else {
                receiver[prop] = provider[prop];
            }
        }
    }
    return receiver;
}

/**
* Extend missing content of 'receiver' with 'provider'
*/
export function extend<T>(receiver: T, provider: T) {
    for (var prop in provider) {
        if ({}.hasOwnProperty.call(provider, prop)) {
            if ({}.hasOwnProperty.call(receiver, prop)) {
                if (typeof provider[prop] === 'object') {
                    this.extend(receiver[prop], provider[prop]);
                }
            } else {
                receiver[prop] = provider[prop];
            }
        }
    }
    return receiver;
}

export interface KeyValue {
    key: string;
    value: string;
}

export function splitOnce(str: string, separator: string): KeyValue {
    var i = str.indexOf(separator);
    if (i >= 0) {
        return {key: str.slice(0, i), value: str.slice(i+separator.length)};
    } else {
        return {key: "", value: str.slice(i+separator.length)};
    }
}

export function mapEquals(map1: {[key: string]: any}, map2: {[key: string]: any}, ignoreKeys?: string[]): boolean {
    ignoreKeys = ignoreKeys || [];
    if (Object.keys(map1).length != Object.keys(map2).length) {
        return false;
    }
    for (var key in map1) {
        if (ignoreKeys.indexOf(key) < 0) {
            if (map1[key] !== map2[key]) {
                return false;
            }
        }
    }
    return true;
}

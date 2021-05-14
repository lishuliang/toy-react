const RENDER_TO_DOM = Symbol('render to dom');
export class Component {
    constructor() {
        this.props = Object.create(null);
        this.children = [];
        this._root = null;
        this._range = null;
    }
    setAttribute(name, value) {
        this.props[name] = value;
    }
    appendChild(component) {
        this.children.push(component);
    }
    get vdom() {
        return this.render().vdom;
    }

    [RENDER_TO_DOM](range) {
        this._range = range;
        this._vdom = this.vdom;
        this._vdom[RENDER_TO_DOM](range);
    }

    update() {
        const isSameNode = (oldNode, newNode) => {
            if (oldNode.type !== newNode.type) return false;
            for (let name in newNode.props) {
                if (oldNode.props[name] !== newNode.props[name]) return false;
            }
            if (
                Object.keys(oldNode.props).length >
                Object.keys(newNode.props).length
            )
                return false;
            if (newNode.type === '#text') {
                if (oldNode.content !== newNode.content) return false;
            }

            return true;
        };

        const update = (oldNode, newNode) => {
            //type,props,children
            //#text content
            if (!isSameNode(oldNode, newNode)) {
                newNode[RENDER_TO_DOM](oldNode._range);
                return;
            }
            newNode._range = oldNode._range;

            const newChildren = newNode.vchildren;
            const oldChildren = oldNode.vchildren;

            if (!newChildren || !newChildren.length) return;

            let tailRange = oldChildren[oldChildren.length - 1]._range;

            for (let i = 0; i < newChildren.length; i++) {
                const newChild = newChildren[i];
                const oldChild = oldChildren[i];
                if (i < oldChildren.length) {
                    update(oldChild, newChild);
                } else {
                    //todo
                    const range = document.createRange();
                    range.setStart(tailRange.endContainer, tailRange.endOffset);
                    range.setEnd(tailRange.endContainer, tailRange.endOffset);
                    newChild[RENDER_TO_DOM](range);
                    tailRange = range;
                }
            }
        };

        const vdom = this.vdom;
        update(this._vdom, vdom);
        this._vdom = vdom;
    }

    /* rerender() {
        const oldRange = this._range;

        const range = document.createRange();
        range.setStart(this._range.startContainer, oldRange.startOffset);
        range.setEnd(this._range.startContainer, oldRange.startOffset);
        this[RENDER_TO_DOM](range);

        oldRange.setStart(range.endContainer, range.endOffset);
        oldRange.deleteContents();
    } */

    setState(newState) {
        if (this.state === null || typeof this.state !== 'object') {
            this.state = newState;
            this.rerender();
            return;
        }
        const merge = (oldState, newState) => {
            for (let p in newState) {
                if (oldState[p] === null || typeof oldState[p] !== 'object') {
                    oldState[p] = newState[p];
                } else {
                    merge(oldState[p], newState[p]);
                }
            }
        };

        merge(this.state, newState);
        this.update();
    }
}

function replaceContent(range, node) {
    range.insertNode(node);
    range.setStartAfter(node);
    range.deleteContents();

    range.setStartBefore(node);
    range.setEndAfter(node);
}

export function createElement(type, attributes, ...children) {
    let e;
    if (typeof type === 'string') {
        e = new ElementWrapper(type);
    } else {
        e = new type();
    }

    for (let p in attributes) {
        e.setAttribute(p, attributes[p]);
    }

    const insertChildren = (children) => {
        for (let child of children) {
            if (typeof child === 'string') {
                child = new TextWrapper(child);
            }
            if (child === null) {
                continue;
            }
            if (Array.isArray(child)) {
                insertChildren(child);
            } else {
                e.appendChild(child);
            }
        }
    };
    insertChildren(children);

    return e;
}

class ElementWrapper extends Component {
    constructor(type) {
        super(type);
        this.type = type;
    }

    get vdom() {
        this.vchildren = this.children.map((child) => child.vdom);
        return this;
    }

    [RENDER_TO_DOM](range) {
        this._range = range;

        const root = document.createElement(this.type);
        for (let name in this.props) {
            const value = this.props[name];
            if (name.match(/^on([\s\S]+)$/)) {
                root.addEventListener(
                    RegExp.$1.replace(/^[\s\S]/, (c) => c.toLowerCase()),
                    value
                );
            } else {
                if (name === 'className') {
                    root.setAttribute('class', value);
                } else {
                    root.setAttribute(name, value);
                }
            }
        }

        if (!this.vchildren)
            this.vchildren = this.children.map((child) => child.vdom);

        for (let child of this.vchildren) {
            const childRange = document.createRange();
            childRange.setStart(root, root.childNodes.length);
            childRange.setEnd(root, root.childNodes.length);
            child[RENDER_TO_DOM](childRange);
        }

        replaceContent(range, root);
    }
}

class TextWrapper extends Component {
    constructor(content) {
        super(content);
        this.content = content;
        this.type = '#text';
    }

    get vdom() {
        return this;
    }

    [RENDER_TO_DOM](range) {
        this._range = range;
        const root = document.createTextNode(this.content);
        replaceContent(range, root);
    }
}

export function render(compoment, parentElement) {
    const range = document.createRange();
    range.setStart(parentElement, 0);
    range.setEnd(parentElement, parentElement.childNodes.length);
    range.deleteContents();
    compoment[RENDER_TO_DOM](range);
}

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
var claude_code_1 = require("claude-code");
var SHOWN = 3;
var files = (0, claude_code_1.atom)({ plugin: 'open-in-editor', key: 'files' }, [], {
    shape: 'files-1',
});
var EDITORS = [
    { label: 'Zed', app: 'Zed' },
    { label: 'VS Code', app: 'Visual Studio Code' },
];
var register = function (on) {
    on('tool.call', { tool: ['Write', 'Edit', 'NotebookEdit'] }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var ran, path;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    ran = _a.sent();
                    if (ran.deny !== undefined || ran.isError === true)
                        return [2 /*return*/, ran];
                    path = 'notebook_path' in e ? e.notebook_path : e.file_path;
                    return [4 /*yield*/, (0, claude_code_1.update)($, files, function (list) { return __spreadArray([path], list.filter(function (one) { return one !== path; }), true).slice(0, SHOWN); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, ran];
            }
        });
    }); }).catch(function ($, e, next) { return (next.called ? undefined : next(e)); });
    on('ui.render', { component: 'AbovePrompt' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var list, below, _a, Box, Text, Button, width, mine;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, files)];
                case 1:
                    list = _b.sent();
                    if (e.props.hasSurvey || list.length === 0)
                        return [2 /*return*/, next(e)
                            // Other mods share this slot: draw theirs below ours instead of replacing it.
                        ];
                    return [4 /*yield*/, next(e).catch(function () { return undefined; })];
                case 2:
                    below = _b.sent();
                    _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text, Button = _a.Button;
                    width = e.surface === 'terminal' ? e.props.bodyColumns : undefined;
                    mine = (<Box flexDirection="column" width={width}>
        {list.map(function (path) { return (<Box key={path} flexDirection="row" gap={2}>
            <Text>{path.split('/').pop()}</Text>
            <Box flexGrow={1} flexShrink={1}>
              <Text dimColor wrap="truncate-start">
                {path.split('/').slice(0, -1).join('/')}
              </Text>
            </Box>
            {EDITORS.map(function (editor) { return (<Button key={"".concat(editor.label, ":").concat(path)} plain label={editor.label} onPress={function () { return void $.process.run(['open', '-a', editor.app, path]); }}/>); })}
            <Button key={"forget:".concat(path)} plain dimColor label="×" onPress={function () { return (0, claude_code_1.update)($, files, function (all) { return all.filter(function (one) { return one !== path; }); }); }}/>
          </Box>); })}
      </Box>);
                    return [2 /*return*/, below ? (<Box flexDirection="column">
        {mine}
        {below}
      </Box>) : (mine)];
            }
        });
    }); }).catch(function ($, e, next) { return next(e); });
};
exports.register = register;

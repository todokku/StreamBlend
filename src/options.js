'use strict';

const LOG = require('./log');
const Misc = require('./misc');
const Constants = require('./constants');
let {agents, ConnectType} = require('./agents');
let errorElement = document.getElementById('errorId');
let connectElement = document.getElementById('connectId');
let darkModeElement = document.getElementById('darkModeId');
let hideOfflineElement = document.getElementById('hideOfflineId');
let hideMixerSideBarElement = document.getElementById('hideMixerSideBarId');

async function setColorScheme()
{
    let dark = Boolean(await Misc.getStorage(Constants.DarkModeName));
    document.body.className = dark ? 'darkScheme' : 'lightScheme';
    darkModeElement.checked = dark;
}

async function setErrors()
{
    let nodes = [];
    for (let a of agents)
    {
        let error = await a.getError();
        if (error)
        {
            a.errorElement.innerHTML = '<div class="row"> \
                                            <div class="errorText">' + error + '</div> \
                                            <div class="errorButton">x</div> \
                                        </div>';
            a.errorElement.getElementsByClassName('errorButton')[0].onclick = (element)=>{ a.setError(''); };
            nodes.push(a.errorElement);
        }
    }
    if (nodes.length)
        nodes[nodes.length - 1].style['margin-bottom'] = '20px';
    while (errorElement.firstChild)
        errorElement.firstChild.remove();
    for (let n of nodes)
        errorElement.appendChild(n);
}

async function setAgentConnect(a)
{
    a.connectElement.getElementsByClassName('loader')[0].style.display = 'none';
    let userName = await a.getUserName();
    switch (a.connectType)
    {
    case ConnectType.UserName:
        if (userName)
        {
            a.connectElement.getElementsByClassName('joinedInput')[0].style.display = 'none';
            a.connectElement.getElementsByClassName('joinedInfo')[0].style.display = 'inline';
            a.connectElement.getElementsByClassName('joinedInfo')[0].innerHTML = 'Connected as <b>' + userName + '</b>';
            a.connectElement.getElementsByClassName('joinedConnect')[0].style.display = 'none';
            a.connectElement.getElementsByClassName('joinedDisconnect')[0].style.display = 'inline';
        }
        else
        {
            a.connectElement.getElementsByClassName('joinedInput')[0].style.display = 'inline';
            a.connectElement.getElementsByClassName('joinedInfo')[0].style.display = 'none';
            a.connectElement.getElementsByClassName('joinedConnect')[0].style.display = 'inline';
            a.connectElement.getElementsByClassName('joinedDisconnect')[0].style.display = 'none';
        }
        break;
    case ConnectType.OAuth:
        if (userName)
        {
            a.connectElement.getElementsByClassName('joinedInfo')[0].style.display = 'inline';
            a.connectElement.getElementsByClassName('joinedInfo')[0].innerHTML = 'Connected as <b>' + userName + '</b>';
            a.connectElement.getElementsByClassName('singleButton')[0].style.display = 'none';
            a.connectElement.getElementsByClassName('joinedDisconnect')[0].style.display = 'inline';
        }
        else
        {
            a.connectElement.getElementsByClassName('joinedInfo')[0].style.display = 'none';
            a.connectElement.getElementsByClassName('singleButton')[0].style.display = 'inline';
            a.connectElement.getElementsByClassName('joinedDisconnect')[0].style.display = 'none';
        }
        break;
    default:
        break;
    }
}

async function refreshFollows()
{
    for (let a of agents)
    {
        await a.setTimeFollowsRefreshed(0);
        a.sendMsgRefreshFollows();
    }
}

async function setConnects()
{
    while (connectElement.firstChild)
        connectElement.firstChild.remove();
    let dark = await Misc.getStorage(Constants.DarkModeName);
    for (let a of agents)
    {
        a.errorElement = document.createElement('div');
        a.connectElement = document.createElement('div');
        connectElement.appendChild(a.connectElement);
        switch (a.connectType)
        {
        case ConnectType.UserName:
            a.connectElement.innerHTML =    '<div class="row"> \
                                                <div class="accountImage"><img src="images/' + (await a.getImage(dark)) + '" alt=""></div> \
                                                <input class="joinedInput" placeholder="Enter your '+ a.name + ' ' + a.userNameDescription + '"> \
                                                <div class="joinedInfo"></div> \
                                                <div class="joinedConnect">Connect</div> \
                                                <div class="joinedDisconnect">Disconnect</div> \
                                                <div class="loader"></div> \
                                            </div>';
            a.connectElement.getElementsByClassName('joinedConnect')[0].onclick = async (element)=>
            {
                if (!a.connectElement.getElementsByClassName('joinedInput')[0].value)
                    return;
                a.connectElement.getElementsByClassName('joinedInput')[0].style.display = 'none';
                a.connectElement.getElementsByClassName('joinedConnect')[0].style.display = 'none';
                a.connectElement.getElementsByClassName('loader')[0].style.display = 'inline';
                await a.authorize(a.connectElement.getElementsByClassName('joinedInput')[0].value);
                await setAgentConnect(a);
                a.sendMsgRefreshFollows();
            };
            a.connectElement.getElementsByClassName('joinedInput')[0].addEventListener("keyup", (event)=>
            {
                if (event.keyCode === 13)
                {
                    event.preventDefault();
                    a.connectElement.getElementsByClassName('joinedConnect')[0].click();
                }
            });
            break;
        case ConnectType.OAuth:
            a.connectElement.innerHTML =    '<div class="row"> \
                                                <div class="accountImage"><img src="images/' + (await a.getImage(dark)) + '" alt=""></div> \
                                                <div class="singleButton">Connect ' + a.name + '</div> \
                                                <div class="joinedInfo"></div> \
                                                <div class="joinedDisconnect">Disconnect</div> \
                                                <div class="loader"></div> \
                                            </div>';
            a.connectElement.getElementsByClassName('singleButton')[0].onclick = async (element)=>
            {
                a.connectElement.getElementsByClassName('singleButton')[0].style.display = 'none';
                a.connectElement.getElementsByClassName('loader')[0].style.display = 'inline';
                chrome.tabs.create({url: await a.getAuthUrl()}, (tab)=>{ a.oauthTabId = tab.id; });
            };
            break;
        default:
            break;
        }
        a.connectElement.getElementsByClassName('joinedDisconnect')[0].onclick = async (element)=>
        {
            await a.setUserName('');
            await a.setFollows([]);
            await a.setTimeFollowsRefreshed(0);
            await setAgentConnect(a);
        };
        setAgentConnect(a);
    }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) =>
{
    LOG("options received message:", request.type);
    switch (request.type)
    {
    case Constants.OAuthMsg:
        if (sender.tab)
        {
            for (let a of agents)
            {
                if (sender.tab.id === a.oauthTabId)
                {
                    await a.authorize(sender.url);
                    await setAgentConnect(a);
                    a.sendMsgRefreshFollows();
                }
            }
            chrome.tabs.remove(sender.tab.id);
        }
        break;
    default:
        for (let a of agents)
        {
            switch (request.type)
            {
            case a.msgError:
                await setErrors();
                break;
            default:
                break;
            }
        }
        break;
    }
    sendResponse({});
});

darkModeElement.onclick = async (element)=>
{
    await Misc.setStorage(Constants.DarkModeName, darkModeElement.checked);
    await setColorScheme();
    await setConnects();
};
Misc.getStorage(Constants.HideOfflineName).then((hide)=>{ hideOfflineElement.checked = Boolean(hide); });
hideOfflineElement.onclick = async (element)=>
{
    await Misc.setStorage(Constants.HideOfflineName, hideOfflineElement.checked);
    refreshFollows();
};
Misc.getStorage(Constants.HideMixerSideBarName).then((show)=>{ hideMixerSideBarElement.checked = Boolean(show); });
hideMixerSideBarElement.onclick = async (element)=>
{
    await Misc.setStorage(Constants.HideMixerSideBarName, hideMixerSideBarElement.checked);
};
document.getElementById('refreshFollowsId').onclick = refreshFollows;

setConnects();
setColorScheme();
setErrors();
chrome.runtime.sendMessage({type: Constants.OptionsTabIdMsg});

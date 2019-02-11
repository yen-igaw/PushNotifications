const React = require('react')
const ReactDOM = require('react-dom')
const iOSComponent = require('./iOSComponent.js')
const AndroidComponent = require('./AndroidComponent.js')
const injectTapEventPlugin = require('react-tap-event-plugin')
const Tab = require('material-ui').Tab
const Tabs = require('material-ui').Tabs
const Paper = require('material-ui').Paper
const APN = require('apn')
const FCM = require('node-gcm')
const Fetch = require('node-fetch')
const Store = require('electron-store')
const store = new Store()

// http://www.material-ui.com/#/get-started/installation
injectTapEventPlugin()

class InputComponent extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            platform: 'ios'
        }

        this.handlePlatformChange = this.handlePlatformChange.bind(this)
    }

    componentWillMount() {
        this.lastState = {
            ios: store.get('ios'),
            android: store.get('android')
        }
    }

    render() {
        const divOptions = {
            style: {
                flex: 1,
                padding: '10px'
            }
        }

        const paperOptions = {

        }

        const tabsOptions = {
            value: this.state.platform.value,
            onChange: this.handlePlatformChange
        }

        const iosOptions = {
            value: 'ios',
            label: 'iOS'
        }

        const androidOptions = {
            value: 'android',
            label: 'Android'
        }

        return React.createElement('div', divOptions,
            React.createElement(Paper, {},
                React.createElement(Tabs, tabsOptions,
                    React.createElement(Tab, iosOptions,
                        React.createElement(iOSComponent, {lastState: this.lastState.ios, ref: 'ios'})
                    ),
                    React.createElement(Tab, androidOptions,
                        React.createElement(AndroidComponent, {lastState: this.lastState.android, ref: 'android'})
                    )
                )
            )
        )
    }

    // action

    handlePlatformChange(value) {
        this.setState({
            platform: value
        })
    }

    send() {
        this.props.updateOutput({
            loading: true,
            text: 'Loading ...'
        })

        if (this.state.platform == 'ios') {
            this.sendiOS()
        } else {
            this.sendAndroid()
        }
    }

    sendiOS() {
        const input = this.refs.ios.state
        store.set('ios', input)

        // options
        let options

        if (input.authentication == 'authCert') {
            // check
            if (input.authCert.file == null) {
                this.props.updateOutput({
                    loading: false,
                    text: 'Failed: Authentication missing'
                })

                return
            }

            options = {
                pfx: input.authCert.file,
                passphrase: input.authCert.passphrase
            }
        } else {
            // check
            if (input.authToken.file == null || input.authToken.keyId == null || input.authToken.teamId == null) {
                this.props.updateOutput({
                    loading: false,
                    text: 'Failed: Authentication missing'
                })

                return
            }

            options = {
                token: {
                    key: input.authToken.file,
                    keyId: input.authToken.keyId,
                    teamId: input.authToken.teamId
                }
            }
        }

        options.production = (input.environment == 'production') ? true : false

        // notification
        const notification = new APN.Notification()
        notification.expiry = Math.floor(Date.now() / 1000) + 3600
        notification.rawPayload = JSON.parse(input.message)
        notification.topic = input.bundleId

        // provider
        const provider = new APN.Provider(options)

        provider.send(notification, input.deviceToken).then( (result) => {
            if (result.failed.length > 0) {
                this.props.updateOutput({
                    loading: false,
                    text: 'Failed: ' + result.failed[0].response.reason || "Unknown"
                })
            } else {
                this.props.updateOutput({
                    loading: false,
                    text: 'Succeeded: ' + input.deviceToken
                })
            }
        })
    }

    sendAndroid() {
        const input = this.refs.android.state
        store.set('android', input)

        // check
        if (input.serverKey == null) {
            this.props.updateOutput({
                loading: false,
                text: 'Failed: Authentication missing'
            })

            return
        }

        // message
        const message = new FCM.Message({
            priority : "high",
            dryRun: false
        })
        const notification_data = JSON.parse(input.message)
        notification_data['com.igaworks.liveops.sender.id'] = true;
        message.addData(notification_data)
        const sender = new FCM.Sender(input.serverKey) // new fcm sender object. QA: Do we need new object or re-use existing one?
        const ids = [input.deviceToken]
        let self = this
        sender.send(message, ids, 2, function(err, result) {
            if (err || !result) {
                console.log('Error occured!: ', err)
                self.props.updateOutput({
                    loading: false,
                    text: 'Failed: ' + err
                })
            } else {
                console.log(result)
                self.props.updateOutput({
                    loading: false,
                    text: 'Succeeded'
                })
            }
        })

    }
}

module.exports = InputComponent